import { clonePlain } from './plain-clone.ts';
import { host } from './utools.ts';
import type { DbResult, StorageDocument } from './utools.ts';
import type { Agent, ApiRoute, ChatMessage, History, HistoryInput, Settings } from '../types.ts';

const SETTINGS_KEY = 'funchat.settings';
// 文档库对单个文档的体积有上限，而 put 失败是静默的——真超了整段聊天记录会凭空消失。
// 一张压缩后的图 base64 就有几十万字符，带图会话很容易撞线，所以留个保守预算。
const HISTORY_SIZE_BUDGET = 1024 * 1024;
// 0.1.x 把所有文档塞在 dbStorage 的一个 JSON 大对象里，每存一条消息都要整库重写一遍。
// 现在改用 uTools 自己的文档库，这两个键只用于一次性搬迁。
const LEGACY_DOCUMENTS_KEY = 'browser.db';
const MIGRATED_KEY = 'funchat.documents.migrated';

export type { StorageDocument } from './utools.ts';
export type { ApiRoute, Settings, HistoryInput } from '../types.ts';

function putDocument(document: StorageDocument): DbResult {
  const result = host.db.put(clonePlain(document));
  if (!result?.error) return result;
  // _rev 过期说明同一条文档在别处被写过（例如先 saveHistory 再 saveAgent 走了同一个对象）。
  // 取回当前 _rev 重试一次，让本次改动生效，而不是把失败咽下去。
  const current = host.db.get(document._id);
  if (!current) return result;
  return host.db.put({ ...clonePlain(document), _rev: current._rev });
}

function removeDocument(id: string): void {
  const document = host.db.get(id);
  if (document) host.db.remove(document);
}

function allDocuments(prefix = ''): StorageDocument[] {
  return host.db.allDocs(prefix);
}

/**
 * 把 0.1.x 存在 dbStorage 单键里的文档搬进 uTools 文档库。
 * 只搬一次，且不删除旧数据——万一搬迁出错，用户的会话还在原处。
 * @returns 无返回值。
 */
function migrateLegacyDocuments(): void {
  if (host.dbStorage.getItem(MIGRATED_KEY)) return;
  const legacy = host.dbStorage.getItem(LEGACY_DOCUMENTS_KEY);
  host.dbStorage.setItem(MIGRATED_KEY, true);
  if (!legacy || typeof legacy !== 'object') return;
  for (const source of Object.values(legacy as Record<string, StorageDocument>)) {
    if (!source?._id || host.db.get(source._id)) continue;
    const document = clonePlain(source);
    delete document._rev;
    host.db.put(document);
  }
}

/**
 * 读取已保存的好友；首次运行时导入内置好友数据。
 * @returns 所有好友存储文档的副本。
 */
export async function loadAgents(): Promise<Agent[]> {
  migrateLegacyDocuments();
  let documents = allDocuments('ai@');
  if (!documents.length) {
    const response = await fetch('./data/agents.json');
    if (!response.ok) throw new Error('无法加载初始好友数据');
    const seed: StorageDocument[] = await response.json();
    for (const source of seed) {
      const document = clonePlain(source);
      delete document._rev;
      host.db.put(document);
    }
    documents = allDocuments('ai@');
  }

  return documents as Agent[];
}

/**
 * 保存好友并将最新修订号写回传入对象。
 * @param agent 要保存的好友存储文档。
 * @returns 无返回值。
 */
export function saveAgent(agent: Agent): void {
  const document = clonePlain(agent) as StorageDocument;
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
  removeDocument(agentId);
  for (const history of allDocuments(`chat@${agentId}#`)) host.db.remove(history);
}

/**
 * 按最近会话优先的顺序读取全部历史记录。
 * @returns 带好友标识和排序键的历史记录副本。
 */
export function loadHistories(): History[] {
  return allDocuments('chat@').flatMap((document) => {
    if (!Array.isArray(document.messages)) return [];
    const separator = document._id.lastIndexOf('#');
    return [{
      ...document,
      messages: document.messages,
      agentId: separator < 0 ? document._id.slice(5) : document._id.slice(5, separator),
      sortKey: separator < 0 ? 0 : Number(document._id.slice(separator + 1)) || 0,
    } as History];
  }).sort((left, right) => right.sortKey - left.sortKey);
}

/**
 * 丢掉最老的图片数据，把会话压到可以写进文档库的体积。
 * 宁可丢图也要保住文字记录——图片片段会留下空占位，界面据此提示图片已清理。
 * @param messages 要保存的消息列表，不会被修改。
 * @param budget 序列化后的字符预算。
 * @returns 可以安全写入的消息副本。
 */
export function stripImagesToFit(messages: ChatMessage[], budget = HISTORY_SIZE_BUDGET): ChatMessage[] {
  const next = clonePlain(messages) as ChatMessage[];
  const oversize = () => JSON.stringify(next).length > budget;
  if (!oversize()) return next;
  for (const message of next) {
    for (const part of Array.isArray(message.content) ? message.content : []) {
      if (part?.type !== 'image_url' || !part.image_url?.url) continue;
      part.image_url.url = '';
      if (!oversize()) return next;
    }
  }
  return next;
}

/**
 * 新建或更新一条聊天历史记录。
 * @param history 会话标识、标题、消息及收藏状态。
 * @returns 无返回值。
 */
export function saveHistory({ id, title, messages, favorite = false }: HistoryInput): void {
  const document: StorageDocument = host.db.get(id) || { _id: id };
  const now = new Date().toLocaleString('zh-CN', { hour12: false });
  document.title = title;
  document.messages = stripImagesToFit(messages);
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
  removeDocument(id);
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
