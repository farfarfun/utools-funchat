import { computed, reactive } from 'vue';
import { streamChat } from '../services/chat.ts';
import { host } from '../services/utools.ts';
import { clonePlain } from '../services/plain-clone.ts';
import {
  loadAgents,
  loadHistories,
  loadSettings,
  removeAgent,
  removeHistory,
  saveAgent,
  saveHistory,
  saveSettings,
  createRouteId,
  syncActiveRoute,
  activeRoute,
} from '../services/storage.ts';
import { buildUserContent, hasContent, withPrefix } from '../features/chat/message-content.ts';
import { estimateConversationTokens, messageText } from '../features/chat/token-count.ts';
import { writeOptionalParams } from '../features/agents/agent-form.ts';
import type {
  Agent,
  AgentFormValues,
  AgentParams,
  ApiRoute,
  AppState,
  ChatMessage,
  History,
  Settings,
} from '../types.ts';

// 这些字段在原插件的导出数据里是可选的：值等于默认值且文档原本没有，就不要写进去，
// 否则「打开设置再保存」会凭空给文档加字段（见 tests/agent-compat.test.ts）。
const OPTIONAL_AGENT_FIELDS: Record<string, string | boolean> = {
  autoPrefix: '',
  status: '',
  callback: '',
  api_id: '',
  isFly: false,
  isOverall: false,
  isFlyNewChat: true,
  isFollowQuestion: false,
  isFunAi: false,
  un_stream: false,
  isAiSummary: false,
};

const state = reactive<AppState>({
  ready: false,
  agents: [],
  currentAgent: null,
  messages: [],
  histories: [],
  settings: loadSettings(),
  loading: false,
  error: '',
  historyOpen: false,
  sidebarCollapsed: false,
  view: 'chat',
});

let abortController: AbortController | null = null;
let activeStream = 0;
let presetHidden = false;
const systemTheme: MediaQueryList | undefined = globalThis.matchMedia?.('(prefers-color-scheme: dark)');

function initialMessages(agent: Agent | null): ChatMessage[] {
  const messages = clonePlain(agent?.params?.messages || []);
  return messages[0]?.role === 'system' ? messages.slice(1) : messages;
}

function presetPrefix(): ChatMessage[] {
  const preset = clonePlain(state.currentAgent?.params?.messages || []);
  return presetHidden ? preset : preset[0]?.role === 'system' ? preset.slice(0, 1) : [];
}

function requestMessages(): ChatMessage[] {
  const size = Math.max(Number(state.currentAgent?.contextLength) || 16, 1) * 2;
  const messages = clonePlain(state.messages.slice(-size)) as ChatMessage[];
  const prefix = String(state.currentAgent?.autoPrefix || '').trim();
  const lastUser = prefix ? messages.findLastIndex((message) => message.role === 'user') : -1;
  const target = lastUser >= 0 ? messages[lastUser] : undefined;
  if (target) target.content = withPrefix(target.content, prefix);
  return [...presetPrefix(), ...messages];
}

function conversationMessages(): ChatMessage[] {
  return [...presetPrefix(), ...clonePlain(state.messages)];
}

// loadHistories 会把所有会话文档（连同完整消息与 base64 图片）全部读出来再克隆一遍，
// 每发一条消息都跑一次的话，几十个带图会话就是每条消息读写好几 MB。改成原地增删。
function upsertHistory(history: History): void {
  const index = state.histories.findIndex((item) => item._id === history._id);
  if (index < 0) state.histories.push(history);
  else state.histories[index] = history;
  state.histories.sort((left, right) => right.sortKey - left.sortKey);
}

function dropHistories(match: (history: History) => boolean): void {
  state.histories = state.histories.filter((history) => !match(history));
}

function removeMessage(message: ChatMessage): void {
  const at = state.messages.indexOf(message);
  if (at >= 0) state.messages.splice(at, 1);
}

function applyTheme(): void {
  const dark = state.settings.theme === 'dark' || (state.settings.theme === 'system' && systemTheme?.matches);
  state.settings.dark = Boolean(dark);
  const body = globalThis.document?.body;
  if (!body) return;
  body.classList.toggle('dark', state.settings.dark);
}

// 插件在 uTools 主面板里的高度由宿主控制，对应设置里的「插件高度」。
// 以前没人调这个接口，那项设置其实一直是空转的。分离成独立窗口后 uTools 会忽略它。
function applyPluginHeight(): void {
  host.setExpendHeight?.(Number(state.settings.windowHeight) || 660);
}

function agentActivityAt(agent: Agent): number {
  const own = Number(agent.created_at) || Number(String(agent._id).slice(3)) || 0;
  return state.histories.reduce((latest, history) => (
    history.agentId === agent._id ? Math.max(latest, history.updatedAt || history.sortKey || 0) : latest
  ), own);
}

function sortAgents(): void {
  state.agents.sort((left, right) => {
    if (Boolean(left.is_top) !== Boolean(right.is_top)) return left.is_top ? -1 : 1;
    return agentActivityAt(right) - agentActivityAt(left);
  });
}

async function init(): Promise<void> {
  state.agents = await loadAgents();
  state.histories = loadHistories();
  sortAgents();
  state.currentAgent = state.agents[0] || null;
  state.messages = [];
  presetHidden = Boolean(state.currentAgent);
  applyTheme();
  applyPluginHeight();
  systemTheme?.addEventListener?.('change', applyTheme);
  state.ready = true;
}

function selectAgent(agent: Agent | null | undefined): void {
  if (!agent) return;
  stop();
  delete agent.chatId;
  state.currentAgent = agent;
  state.messages = initialMessages(agent);
  presetHidden = false;
  state.error = '';
  state.historyOpen = false;
  state.view = 'chat';
}

function cycleAgent(step: number): void {
  if (state.agents.length < 2) return;
  const index = state.agents.findIndex((agent) => agent._id === state.currentAgent?._id);
  selectAgent(state.agents[(index + step + state.agents.length) % state.agents.length]);
}

function addAgent(values: AgentFormValues): void {
  const nickname = values.nickname.trim();
  const agent: Agent = {
    _id: `ai@${Date.now()}`,
    nickname,
    info: values.info.trim() || '自定义 AI 好友',
    content: values.content.trim() || `你好，我是${nickname}，需要帮助吗？`,
    avatar: clonePlain(values.avatar) || { type: 'icon', icon: 'icon-a1', color: '#0ca47f', text: nickname.slice(0, 1) },
    contextLength: Number(values.contextLength) || 16,
    autoPrefix: values.autoPrefix.trim(),
    isFly: Boolean(values.isFly),
    isOverall: Boolean(values.isOverall),
    isFlyNewChat: values.isFlyNewChat !== false,
    isFollowQuestion: Boolean(values.isFollowQuestion),
    isFunAi: values.type === 'function',
    api_id: values.api_id || '',
    un_stream: Boolean(values.un_stream),
    callback: values.callback || '',
    isAiSummary: Boolean(values.isAiSummary),
    quick_questions: clonePlain(values.quick_questions || []),
    is_author: true,
    params: {
      ...(values.model.trim() ? { model: values.model.trim() } : {}),
      messages: [{ role: 'system', content: values.prompt.trim() }],
      temperature: Number(values.temperature),
      top_p: Number(values.top_p),
      presence_penalty: Number(values.presence_penalty),
      frequency_penalty: Number(values.frequency_penalty),
      max_tokens: Number(values.max_tokens) || 0,
      ...(values.paramsFunctions ? { functions: values.paramsFunctions } : {}),
    },
    created_at: String(Date.now()),
  };
  saveAgent(agent);
  state.agents.push(agent);
  sortAgents();
  selectAgent(agent);
}

function updateAgent(agent: Agent, values: AgentFormValues): void {
  const prompt = values.prompt.trim();
  const messages = clonePlain(agent.params?.messages || []);
  if (messages[0]?.role === 'system') messages[0].content = prompt;
  else if (prompt) messages.unshift({ role: 'system', content: prompt });

  const params: AgentParams = { ...agent.params, messages };
  if (values.model.trim()) params.model = values.model.trim();
  else delete params.model;
  writeOptionalParams(params, agent.params, values);
  if (values.paramsFunctions) params.functions = values.paramsFunctions;
  else delete params.functions;

  Object.assign(agent, {
    nickname: values.nickname.trim(),
    info: values.info.trim(),
    content: values.content.trim(),
    contextLength: Number(values.contextLength) || 16,
    params,
  });

  const incoming: Record<string, string | boolean> = {
    autoPrefix: values.autoPrefix.trim(),
    status: values.status || '',
    callback: values.callback || '',
    api_id: values.api_id || '',
    isFly: Boolean(values.isFly),
    isOverall: Boolean(values.isOverall),
    isFlyNewChat: values.isFlyNewChat !== false,
    isFollowQuestion: Boolean(values.isFollowQuestion),
    isFunAi: values.type === 'function',
    un_stream: Boolean(values.un_stream),
    isAiSummary: Boolean(values.isAiSummary),
  };
  for (const [key, fallback] of Object.entries(OPTIONAL_AGENT_FIELDS)) {
    if (key in agent || incoming[key] !== fallback) agent[key] = incoming[key];
    else delete agent[key];
  }
  const questions = clonePlain(values.quick_questions || []);
  if ('quick_questions' in agent || questions.length) agent.quick_questions = questions;
  else delete agent.quick_questions;

  saveAgent(agent);
}

function deleteAgent(agent: Agent): void {
  const index = state.agents.indexOf(agent);
  if (index < 0) return;
  removeAgent(agent._id);
  state.agents.splice(index, 1);
  dropHistories((history) => history.agentId === agent._id);
  if (state.currentAgent?._id !== agent._id) return;
  const next = state.agents[Math.max(0, index - 1)];
  if (next) {
    selectAgent(next);
    return;
  }
  state.currentAgent = null;
  state.messages = [];
  presetHidden = false;
  state.error = '';
}

function togglePin(agent: Agent): void {
  agent.is_top = !agent.is_top;
  saveAgent(agent);
  sortAgents();
}

function newConversation(): void {
  stop();
  state.messages = [];
  presetHidden = Boolean(state.currentAgent);
  if (state.currentAgent) state.currentAgent.chatId = `chat@${state.currentAgent._id}#${Date.now()}`;
}

/**
 * 发出一条用户消息。
 * @param text 输入框文字。
 * @param images 随消息一起发送的图片 data URL，可为空。
 * @returns 真的发出去了返回 `true`；内容为空或正在生成时返回 `false`。
 */
async function send(text: string, images: readonly string[] = []): Promise<boolean> {
  return sendContent(buildUserContent(text, images));
}

async function sendContent(content: ChatMessage['content']): Promise<boolean> {
  if (!hasContent(content) || state.loading || !state.currentAgent) return false;
  state.messages.push({ role: 'user', content }, { role: 'assistant', content: '' });
  const assistantMessage = state.messages.at(-1) as ChatMessage;
  const streamId = ++activeStream;
  state.loading = true;
  state.error = '';
  abortController = new AbortController();

  try {
    await streamChat({
      settings: state.settings,
      agent: state.currentAgent,
      messages: requestMessages().slice(0, -1),
      signal: abortController.signal,
      onDelta: (chunk) => { if (streamId === activeStream) assistantMessage.content += chunk; },
    });
    if (streamId === activeStream && !assistantMessage.content) assistantMessage.content = '服务端没有返回内容。';
  } catch (error) {
    const failure = error as { name?: string; message?: string } | null;
    if (failure?.name === 'AbortError') {
      if (!assistantMessage.content) removeMessage(assistantMessage);
    } else if (streamId === activeStream) {
      state.error = failure?.message || String(error);
      assistantMessage.content = `请求失败：${state.error}`;
      assistantMessage.error = true;
    }
  } finally {
    if (streamId === activeStream) {
      state.loading = false;
      abortController = null;
      if (state.messages.includes(assistantMessage)) persistCurrentConversation();
    }
  }
  return true;
}

function stop(): void {
  if (!state.loading && !abortController) return;
  activeStream += 1;
  abortController?.abort();
  abortController = null;
  state.loading = false;
  const last = state.messages.at(-1);
  if (last?.role === 'assistant' && !messageText(last)) removeMessage(last);
  persistCurrentConversation();
}

function persistCurrentConversation(): void {
  if (!state.currentAgent || !state.messages.some((message) => message.role === 'user')) return;
  const id = state.currentAgent.chatId || `chat@${state.currentAgent._id}#${Date.now()}`;
  state.currentAgent.chatId = id;
  const firstUser = state.messages.find((message) => message.role === 'user');
  const existing = state.histories.find((history) => history._id === id);
  upsertHistory(saveHistory({
    id,
    title: Array.from(messageText(firstUser)).slice(0, 20).join('') || '新话题',
    messages: conversationMessages(),
    favorite: existing?.isFavorite,
  }));
  sortAgents();
}

function openHistory(history: History): void {
  const agent = state.agents.find((item) => item._id === history.agentId);
  if (!agent) return;
  stop();
  state.currentAgent = agent;
  agent.chatId = history._id;
  state.messages = history.messages[0]?.role === 'system' ? clonePlain(history.messages.slice(1)) : clonePlain(history.messages);
  presetHidden = false;
  state.error = '';
  state.historyOpen = false;
  state.view = 'chat';
}

function deleteHistory(history: History): void {
  removeHistory(history._id);
  dropHistories((item) => item._id === history._id);
  sortAgents();
  if (state.currentAgent?.chatId === history._id) newConversation();
}

function toggleFavorite(history: History): void {
  upsertHistory(saveHistory({
    id: history._id,
    title: history.title || '',
    messages: history.messages,
    favorite: !history.isFavorite,
  }));
}

function deleteMessage(index: number): void {
  state.messages.splice(index, 1);
  persistCurrentConversation();
}

async function retryMessage(index: number): Promise<void> {
  if (state.loading || !state.currentAgent) return;
  const userIndex = state.messages.slice(0, index).findLastIndex((message) => message.role === 'user');
  if (userIndex < 0) return;
  // 原样重放：带图的问题要连图一起重发，不能只把文字取出来
  const original = clonePlain(state.messages[userIndex].content) as ChatMessage['content'];
  const content = typeof original === 'string' ? original.trim() : original;
  if (!hasContent(content)) return;
  state.messages.splice(userIndex);
  await sendContent(content);
}

function updateSettings(next: Partial<Settings>): void {
  Object.assign(state.settings, next);
  // 线路可能被切换或删除，镜像字段要跟着走，否则 streamChat 还在用旧地址
  syncActiveRoute(state.settings);
  applyTheme();
  applyPluginHeight();
  saveSettings(state.settings);
}

function saveApiRoute(route: ApiRoute): void {
  const routes = state.settings.apiRoutes || [];
  const index = routes.findIndex((item) => item.id === route.id);
  if (index < 0) routes.push({ ...route, id: route.id || createRouteId() });
  else routes[index] = { ...routes[index], ...route };
  updateSettings({ apiRoutes: routes, activeRouteId: route.id || routes.at(-1)?.id || '' });
}

function removeApiRoute(routeId: string): void {
  const routes = (state.settings.apiRoutes || []).filter((route) => route.id !== routeId);
  // 删掉的正好是当前线路时，把 activeRouteId 清空，让 syncActiveRoute 退回第一条
  const activeRouteId = state.settings.activeRouteId === routeId ? '' : state.settings.activeRouteId;
  Object.assign(state.settings, { apiRoutes: routes, activeRouteId });
  if (!routes.length) Object.assign(state.settings, { baseUrl: '', apiKey: '', provider: 'openai' });
  updateSettings({});
}

function selectApiRoute(routeId: string): void {
  updateSettings({ activeRouteId: routeId });
}

// 当前线路拉回来的模型清单。好友自身用过的模型也并进来，
// 这样手动填过、或清单里已经下架的模型不会从选择器里消失。
const routeModels = computed(() => {
  const fetched = activeRoute(state.settings)?.models || [];
  const used = state.agents.map((agent) => agent.params?.model).filter(Boolean) as string[];
  return [...new Set([...fetched, ...used])];
});

const tokenCount = computed(() => estimateConversationTokens(state.messages));
const agentHistories = computed(() => state.histories.filter((history) => history.agentId === state.currentAgent?._id));

export function useChatStore() {
  return {
    state,
    tokenCount,
    agentHistories,
    routeModels,
    init,
    selectAgent,
    cycleAgent,
    addAgent,
    updateAgent,
    deleteAgent,
    togglePin,
    newConversation,
    send,
    stop,
    persistCurrentConversation,
    openHistory,
    deleteHistory,
    toggleFavorite,
    deleteMessage,
    retryMessage,
    updateSettings,
    saveApiRoute,
    removeApiRoute,
    selectApiRoute,
  };
}
