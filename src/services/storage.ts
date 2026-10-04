import { clonePlain } from './plain-clone.ts';
import { host } from './utools.ts';

const SETTINGS_KEY = 'funchat.settings';
const DOCUMENTS_KEY = 'browser.db';

export type StorageDocument = Record<string, any> & { _id: string; _rev?: string; chatId?: unknown; messages?: unknown[] };
export type HistoryInput = { id: string; title: string; messages: unknown[]; favorite?: boolean };
export type ApiRoute = Record<string, any> & { id: string; name: string; provider: string; baseUrl: string; apiKey: string; streamMode: string; wasActive?: boolean };
export type Settings = Record<string, any> & { apiRoutes?: ApiRoute[]; activeRouteId?: string; provider?: string; baseUrl?: string; apiKey?: string };

function documents(): Record<string, StorageDocument> {
  return host.dbStorage.getItem(DOCUMENTS_KEY) || {};
}

function saveDocuments(value: Record<string, StorageDocument>): void {
  host.dbStorage.setItem(DOCUMENTS_KEY, value);
}

function putDocument(document: StorageDocument): { ok: true; id: string; rev: string } {
  const all = documents();
  const previous = all[document._id];
  const next = { ...clonePlain(document), _rev: `${Number.parseInt(previous?._rev, 10) + 1 || 1}-storage` };
  all[next._id] = next;
  saveDocuments(all);
  return { ok: true, id: next._id, rev: next._rev };
}

function getDocument(id: string): StorageDocument | null {
  return clonePlain(documents()[id] || null);
}

function allDocuments(prefix = ''): StorageDocument[] {
  return Object.values(documents()).filter((document) => document._id.startsWith(prefix)).map(clonePlain);
}

/**
 * 读取已保存的好友；首次运行时导入内置好友数据。
 * @returns 所有好友存储文档的副本。
 */
export async function loadAgents(): Promise<StorageDocument[]> {
  let documents = allDocuments('ai@');
  if (!documents.length) {
    const response = await fetch('./data/agents.json');
    if (!response.ok) throw new Error('无法加载初始好友数据');
    documents = await response.json();
    for (const source of documents) {
      const document = clonePlain(source);
      delete document._rev;
      putDocument(document);
    }
    documents = allDocuments('ai@');
  }

  return documents;
}

/**
 * 保存好友并将最新修订号写回传入对象。
 * @param agent 要保存的好友存储文档。
 * @returns 无返回值。
 */
export function saveAgent(agent: StorageDocument): void {
  const document = clonePlain(agent);
  delete document.chatId;
  const result = putDocument(document);
  if (result?.rev) agent._rev = result.rev;
}

/**
 * 删除好友及其全部历史会话。
 * @param agentId 要删除的好友标识。
 * @returns 无返回值。
 */
export function removeAgent(agentId: string): void {
  const all = documents();
  delete all[agentId];
  for (const history of allDocuments(`chat@${agentId}#`)) delete all[history._id];
  saveDocuments(all);
}

/**
 * 按最近会话优先的顺序读取全部历史记录。
 * @returns 带好友标识和排序键的历史记录副本。
 */
export function loadHistories(): StorageDocument[] {
  return allDocuments('chat@').flatMap((document) => {
    if (!Array.isArray(document.messages)) return [];
    const separator = document._id.lastIndexOf('#');
    return [{ ...document, messages: clonePlain(document.messages), agentId: separator < 0 ? document._id.slice(5) : document._id.slice(5, separator), sortKey: separator < 0 ? 0 : Number(document._id.slice(separator + 1)) || 0 }];
  }).sort((left, right) => right.sortKey - left.sortKey);
}

/**
 * 新建或更新一条聊天历史记录。
 * @param history 会话标识、标题、消息及收藏状态。
 * @returns 无返回值。
 */
export function saveHistory({ id, title, messages, favorite = false }: HistoryInput): void {
  const document = getDocument(id) || { _id: id };
  const now = new Date().toLocaleString('zh-CN', { hour12: false });
  document.title = title;
  document.messages = clonePlain(messages);
  document.createdDate ||= now;
  document.updatedDate = now;
  document.updatedAt = Date.now();
  document.isFavorite = favorite;
  putDocument(document);
}

/**
 * 删除指定聊天历史记录。
 * @param id 要删除的会话标识。
 * @returns 无返回值。
 */
export function removeHistory(id: string): void {
  const all = documents();
  delete all[id];
  saveDocuments(all);
}

let routeSeed = 0;
/**
 * 生成当前运行期内唯一的 API 路线标识。
 * @returns 新生成的路线标识。
 */
export function createRouteId(): string {
  routeSeed += 1;
  return `route-${Date.now().toString(36)}-${routeSeed}`;
}

// 把旧版 apiProxy 数组整个搬过来。老实现只挑 isOpen 那一条、其余直接丢弃，
// 用户配过的多条线路就是这样丢的——这里全部保留。
/**
 * 将旧版单线路或线路数组迁移为当前路线结构。
 * @param legacy 旧版 `apiProxy` 存储值。
 * @returns 可用的 API 路线列表。
 */
export function routesFromLegacy(legacy: unknown): ApiRoute[] {
  const entries: any[] = Array.isArray(legacy) ? legacy : [legacy];
  return entries
    .filter((item) => item && (item.url || item.apiKey || item.value === 200))
    .map((item, index) => ({
      id: createRouteId(),
      name: item.name || (item.value === 200 ? 'uTools AI' : `线路 ${index + 1}`),
      provider: item.value === 200 ? 'utools' : 'openai',
      baseUrl: item.url || '',
      apiKey: item.apiKey || '',
      streamMode: item.streamMode || 'client',
      wasActive: Boolean(item.isOpen),
    }));
}

/**
 * 获取设置中当前选中的路线，缺失时回退到第一条。
 * @param settings 含 API 路线的设置对象。
 * @returns 当前路线；没有路线时返回 `null`。
 */
export function activeRoute(settings: Settings): ApiRoute | null {
  const routes = settings?.apiRoutes || [];
  return routes.find((route) => route.id === settings.activeRouteId) || routes[0] || null;
}

// provider/baseUrl/apiKey 作为当前线路的镜像字段保留，
// 这样 streamChat 和各处的「是否已配置」判断都不用改。
/**
 * 将当前路线字段同步到兼容旧调用方的设置镜像字段。
 * @param settings 要同步的设置对象。
 * @returns 同一个已同步的设置对象。
 */
export function syncActiveRoute(settings: Settings): Settings {
  const route = activeRoute(settings);
  if (!route) return settings;
  settings.activeRouteId = route.id;
  settings.provider = route.provider || 'openai';
  settings.baseUrl = route.baseUrl || '';
  settings.apiKey = route.apiKey || '';
  return settings;
}

function ensureRoutes(settings: Settings): Settings {
  if (Array.isArray(settings.apiRoutes) && settings.apiRoutes.length) return syncActiveRoute(settings);
  // 老版本只存了单条，包装成第一条线路
  if (settings.baseUrl || settings.apiKey || settings.provider === 'utools') {
    settings.apiRoutes = [{
      id: createRouteId(),
      name: settings.provider === 'utools' ? 'uTools AI' : '默认线路',
      provider: settings.provider || 'openai',
      baseUrl: settings.baseUrl || '',
      apiKey: settings.apiKey || '',
      streamMode: 'client',
    }];
  } else {
    settings.apiRoutes = [];
  }
  return syncActiveRoute(settings);
}

/**
 * 读取设置，并在需要时从旧版存储格式迁移路线数据。
 * @returns 当前应用设置。
 */
export function loadSettings(): Settings {
  const stored = host.dbStorage.getItem(SETTINGS_KEY);
  if (stored) return ensureRoutes({ ...stored, theme: stored.theme || (stored.dark ? 'dark' : 'system') });

  const routes = routesFromLegacy(host.dbStorage.getItem('apiProxy'));
  const preferred = routes.find((route) => route.wasActive) || routes[0];
  for (const route of routes) delete route.wasActive;

  return syncActiveRoute({
    apiRoutes: routes,
    activeRouteId: preferred?.id || '',
    provider: 'openai',
    baseUrl: '',
    apiKey: '',
    model: 'gpt-4.1-mini',
    theme: host.dbStorage.getItem('isDark') ? 'dark' : 'system',
    dark: host.dbStorage.getItem('isDark') || false,
  });
}

/**
 * 将设置的纯数据副本写入本地存储。
 * @param settings 要保存的应用设置。
 * @returns 无返回值。
 */
export function saveSettings(settings: Settings): void {
  host.dbStorage.setItem(SETTINGS_KEY, clonePlain(settings));
}
