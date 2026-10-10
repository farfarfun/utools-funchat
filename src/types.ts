export type { StorageDocument } from './services/utools.ts';

// 文档类型统一写成 `Record<string, any> & { 已知字段 }`：
// 好友文档要和原插件导出的数据保持字段级兼容（见 tests/agent-compat.test.ts），
// 不能用封闭类型把未知的历史字段挡在外面，但已知字段仍然要有提示和检查。

// 多模态消息片段，字段名沿用 OpenAI 的 chat completions 结构，
// 这样带图的消息可以直接塞进请求体，不需要再转一层。
export type MessagePart = {
  type?: string;
  text?: string;
  image_url?: { url?: string };
  file?: { filename?: string };
};

export type ChatMessage = Record<string, any> & {
  role?: string;
  content?: string | MessagePart[] | null;
  error?: boolean;
};

export type AgentAvatar = Record<string, any> & {
  type?: 'icon' | 'emoji' | 'image' | 'text' | string;
  icon?: string;
  emoji?: string;
  image?: string;
  text?: string;
  color?: string;
  gradient?: string[];
};

export type AgentParams = Record<string, any> & {
  model?: string;
  messages?: ChatMessage[];
  temperature?: number;
  top_p?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  max_tokens?: number;
  functions?: unknown;
};

export type Agent = Record<string, any> & {
  _id: string;
  _rev?: string;
  nickname: string;
  info?: string;
  content?: string;
  avatar?: AgentAvatar;
  contextLength?: number;
  params?: AgentParams;
  autoPrefix?: string;
  quick_questions?: string[];
  is_top?: boolean;
  created_at?: string;
  un_stream?: boolean;
  /** 当前打开的话题 id，只存在于内存，保存时会被剥掉。 */
  chatId?: string;
};

export type History = Record<string, any> & {
  _id: string;
  _rev?: string;
  title?: string;
  messages: ChatMessage[];
  isFavorite?: boolean;
  createdDate?: string;
  updatedDate?: string;
  updatedAt?: number;
  /** 由 `_id` 解析出来，不落盘。 */
  agentId: string;
  /** 由 `_id` 里的时间戳解析出来，用于排序，不落盘。 */
  sortKey: number;
};

export type ApiRoute = Record<string, any> & {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
  /** 从 /v1/models 拉回来的可用模型清单，随线路一起保存。 */
  models?: string[];
  /** 上次拉取模型的时间戳，用于在界面上提示清单的新鲜度。 */
  modelsFetchedAt?: number;
  /** 仅迁移期间使用：标记旧数据里处于启用状态的那条线路。 */
  wasActive?: boolean;
};

export type ThemePreference = 'light' | 'dark' | 'system';

export type Settings = Record<string, any> & {
  apiRoutes?: ApiRoute[];
  activeRouteId?: string;
  /** 以下三项是当前线路的镜像字段，由 `syncActiveRoute` 维护。 */
  provider?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  theme?: ThemePreference;
  dark?: boolean;
};

export type HistoryInput = {
  id: string;
  title: string;
  messages: ChatMessage[];
  favorite?: boolean;
};

export type AgentFormValues = Record<string, any> & {
  model: string;
  type: string;
  nickname: string;
  info: string;
  content: string;
  prompt: string;
  functions: string;
  callback: string;
  isAiSummary: boolean;
  autoPrefix: string;
  isFly: boolean;
  isOverall: boolean;
  isFlyNewChat: boolean;
  status: string;
  contextLength: number;
  max_tokens: number;
  temperature: number;
  top_p: number;
  presence_penalty: number;
  frequency_penalty: number;
  quick_questions: string[];
  isFollowQuestion: boolean;
  api_id: string;
  un_stream: boolean;
  paramsFunctions?: unknown;
};

export type AppView = 'chat' | 'prompts' | 'settings' | string;

export type AppState = {
  ready: boolean;
  agents: Agent[];
  currentAgent: Agent | null;
  messages: ChatMessage[];
  histories: History[];
  settings: Settings;
  loading: boolean;
  error: string;
  historyOpen: boolean;
  sidebarCollapsed: boolean;
  view: AppView;
};
