import { computed, reactive } from 'vue';
import { streamChat } from '../services/chat.js';
import { clonePlain } from '../services/plain-clone.js';
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
} from '../services/storage.js';
import { estimateConversationTokens, messageText } from '../features/chat/token-count.js';
import { writeOptionalParams } from '../features/agents/agent-form.js';

const OPTIONAL_AGENT_FIELDS = {
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

const state = reactive({
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

let abortController;
let activeStream = 0;
let presetHidden = false;
const systemTheme = globalThis.matchMedia?.('(prefers-color-scheme: dark)');

function initialMessages(agent) {
  const messages = clonePlain(agent?.params?.messages || []);
  return messages[0]?.role === 'system' ? messages.slice(1) : messages;
}

function presetPrefix() {
  const preset = clonePlain(state.currentAgent?.params?.messages || []);
  return presetHidden ? preset : preset[0]?.role === 'system' ? preset.slice(0, 1) : [];
}

function requestMessages() {
  const size = Math.max(Number(state.currentAgent?.contextLength) || 16, 1) * 2;
  const messages = clonePlain(state.messages.slice(-size));
  const prefix = String(state.currentAgent?.autoPrefix || '').trim();
  const lastUser = prefix ? messages.findLastIndex((message) => message.role === 'user') : -1;
  if (lastUser >= 0 && typeof messages[lastUser].content === 'string') {
    messages[lastUser].content = prefix + messages[lastUser].content;
  }
  return [...presetPrefix(), ...messages];
}

function conversationMessages() {
  return [...presetPrefix(), ...clonePlain(state.messages)];
}

function removeMessage(message) {
  const at = state.messages.indexOf(message);
  if (at >= 0) state.messages.splice(at, 1);
}

function applyTheme() {
  const dark = state.settings.theme === 'dark' || (state.settings.theme === 'system' && systemTheme?.matches);
  state.settings.dark = Boolean(dark);
  const body = globalThis.document?.body;
  if (!body) return;
  body.classList.toggle('dark', state.settings.dark);
}

function agentActivityAt(agent) {
  const own = Number(agent.created_at) || Number(String(agent._id).slice(3)) || 0;
  return state.histories.reduce((latest, history) => (
    history.agentId === agent._id ? Math.max(latest, history.updatedAt || history.sortKey || 0) : latest
  ), own);
}

function sortAgents() {
  state.agents.sort((left, right) => {
    if (Boolean(left.is_top) !== Boolean(right.is_top)) return left.is_top ? -1 : 1;
    return agentActivityAt(right) - agentActivityAt(left);
  });
}

async function init() {
  state.agents = await loadAgents();
  state.histories = loadHistories();
  sortAgents();
  state.currentAgent = state.agents[0] || null;
  state.messages = [];
  presetHidden = Boolean(state.currentAgent);
  applyTheme();
  systemTheme?.addEventListener?.('change', applyTheme);
  state.ready = true;
}

function selectAgent(agent) {
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

function cycleAgent(step) {
  if (state.agents.length < 2) return;
  const index = state.agents.findIndex((agent) => agent._id === state.currentAgent?._id);
  selectAgent(state.agents[(index + step + state.agents.length) % state.agents.length]);
}

function addAgent(values) {
  const nickname = values.nickname.trim();
  const agent = {
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

function updateAgent(agent, values) {
  const prompt = values.prompt.trim();
  const messages = clonePlain(agent.params?.messages || []);
  if (messages[0]?.role === 'system') messages[0].content = prompt;
  else if (prompt) messages.unshift({ role: 'system', content: prompt });

  const params = { ...agent.params, messages };
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

  const incoming = {
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

function deleteAgent(agent) {
  const index = state.agents.indexOf(agent);
  if (index < 0) return;
  removeAgent(agent._id);
  state.agents.splice(index, 1);
  state.histories = loadHistories();
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

function togglePin(agent) {
  agent.is_top = !agent.is_top;
  saveAgent(agent);
  sortAgents();
}

function newConversation() {
  stop();
  state.messages = [];
  presetHidden = Boolean(state.currentAgent);
  if (state.currentAgent) state.currentAgent.chatId = `chat@${state.currentAgent._id}#${Date.now()}`;
}

async function send(text) {
  const content = String(text || '').trim();
  if (!content || state.loading || !state.currentAgent) return false;
  state.messages.push({ role: 'user', content }, { role: 'assistant', content: '' });
  const assistantMessage = state.messages.at(-1);
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
    if (error.name === 'AbortError') {
      if (!assistantMessage.content) removeMessage(assistantMessage);
    } else if (streamId === activeStream) {
      state.error = error.message || String(error);
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

function stop() {
  if (!state.loading && !abortController) return;
  activeStream += 1;
  abortController?.abort();
  abortController = null;
  state.loading = false;
  const last = state.messages.at(-1);
  if (last?.role === 'assistant' && !messageText(last)) removeMessage(last);
  persistCurrentConversation();
}

function persistCurrentConversation() {
  if (!state.currentAgent || !state.messages.some((message) => message.role === 'user')) return;
  const id = state.currentAgent.chatId || `chat@${state.currentAgent._id}#${Date.now()}`;
  state.currentAgent.chatId = id;
  const firstUser = state.messages.find((message) => message.role === 'user');
  const existing = state.histories.find((history) => history._id === id);
  saveHistory({
    id,
    title: Array.from(messageText(firstUser)).slice(0, 20).join('') || '新话题',
    messages: conversationMessages(),
    favorite: existing?.isFavorite,
  });
  state.histories = loadHistories();
  sortAgents();
}

function openHistory(history) {
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

function deleteHistory(history) {
  removeHistory(history._id);
  state.histories = loadHistories();
  sortAgents();
  if (state.currentAgent?.chatId === history._id) newConversation();
}

function toggleFavorite(history) {
  saveHistory({
    id: history._id,
    title: history.title,
    messages: history.messages,
    favorite: !history.isFavorite,
  });
  state.histories = loadHistories();
}

function deleteMessage(index) {
  state.messages.splice(index, 1);
  persistCurrentConversation();
}

async function retryMessage(index) {
  if (state.loading || !state.currentAgent) return;
  const userIndex = state.messages.slice(0, index).findLastIndex((message) => message.role === 'user');
  if (userIndex < 0) return;
  const content = messageText(state.messages[userIndex]).trim();
  if (!content) return;
  state.messages.splice(userIndex);
  await send(content);
}

function updateSettings(next) {
  Object.assign(state.settings, next);
  // 线路可能被切换或删除，镜像字段要跟着走，否则 streamChat 还在用旧地址
  syncActiveRoute(state.settings);
  applyTheme();
  saveSettings(state.settings);
}

function saveApiRoute(route) {
  const routes = state.settings.apiRoutes || [];
  const index = routes.findIndex((item) => item.id === route.id);
  if (index < 0) routes.push({ ...route, id: route.id || createRouteId() });
  else routes[index] = { ...routes[index], ...route };
  updateSettings({ apiRoutes: routes, activeRouteId: route.id || routes.at(-1).id });
}

function removeApiRoute(routeId) {
  const routes = (state.settings.apiRoutes || []).filter((route) => route.id !== routeId);
  // 删掉的正好是当前线路时，把 activeRouteId 清空，让 syncActiveRoute 退回第一条
  const activeRouteId = state.settings.activeRouteId === routeId ? '' : state.settings.activeRouteId;
  Object.assign(state.settings, { apiRoutes: routes, activeRouteId });
  if (!routes.length) Object.assign(state.settings, { baseUrl: '', apiKey: '', provider: 'openai' });
  updateSettings({});
}

function selectApiRoute(routeId) {
  updateSettings({ activeRouteId: routeId });
}

const tokenCount = computed(() => estimateConversationTokens(state.messages));
const agentHistories = computed(() => state.histories.filter((history) => history.agentId === state.currentAgent?._id));

export function useChatStore() {
  return {
    state,
    tokenCount,
    agentHistories,
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
