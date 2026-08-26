import CryptoJS from 'crypto-js';
import { clonePlain } from './plain-clone.js';
import { host } from './utools.js';

const SETTINGS_KEY = 'funchat.settings';

function decrypt(value, key) {
  if (typeof value !== 'string' || !value.startsWith('U2FsdGVkX1')) return value;
  try {
    const bytes = CryptoJS.AES.decrypt(value, key);
    if (bytes.sigBytes <= 0) return '';
    return bytes.toString(CryptoJS.enc.Utf8) || value;
  } catch {
    return value;
  }
}

function encrypt(value, key) {
  return CryptoJS.AES.encrypt(String(value || ''), key).toString();
}

function putDocument(document) {
  const result = host.db.put(document);
  if (!result?.error) return result;
  const latest = host.db.get(document._id);
  if (!latest?._rev || latest._rev === document._rev) return result;
  return host.db.put({ ...document, _rev: latest._rev });
}

function decodeAgent(document) {
  const agent = clonePlain(document);
  const first = agent.params?.messages?.[0];
  if (first) first.content = decrypt(first.content, agent._id);
  return agent;
}

export async function loadAgents() {
  let documents = host.db.allDocs('ai@') || [];
  if (!documents.length) {
    const response = await fetch('./data/agents.json');
    if (!response.ok) throw new Error('无法加载初始好友数据');
    documents = await response.json();
    for (const source of documents) {
      const document = clonePlain(source);
      delete document._rev;
      const first = document.params?.messages?.[0];
      if (first) first.content = encrypt(first.content, document._id);
      host.db.put(document);
    }
    documents = host.db.allDocs('ai@') || [];
  }

  return documents.map(decodeAgent);
}

export function saveAgent(agent) {
  const document = clonePlain(agent);
  delete document.chatId;
  const first = document.params?.messages?.[0];
  if (first) first.content = encrypt(first.content, document._id);
  const result = putDocument(document);
  if (result?.rev) agent._rev = result.rev;
}

export function removeAgent(agentId) {
  host.db.remove(agentId);
  for (const history of host.db.allDocs(`chat@${agentId}#`) || []) host.db.remove(history._id);
}

export function loadHistories() {
  return (host.db.allDocs('chat@') || []).flatMap((document) => {
    try {
      const messages = Array.isArray(document.messages)
        ? clonePlain(document.messages)
        : JSON.parse(decrypt(document.messages, document._id));
      const separator = document._id.lastIndexOf('#');
      return [{
        ...document,
        messages,
        agentId: separator < 0 ? document._id.slice(5) : document._id.slice(5, separator),
        sortKey: separator < 0 ? 0 : Number(document._id.slice(separator + 1)) || 0,
      }];
    } catch {
      return [];
    }
  }).sort((left, right) => right.sortKey - left.sortKey);
}

export function saveHistory({ id, title, messages, favorite = false }) {
  const document = host.db.get(id) || { _id: id };
  const now = new Date().toLocaleString('zh-CN', { hour12: false });
  document.title = title;
  document.messages = encrypt(JSON.stringify(messages), id);
  document.createdDate ||= now;
  document.updatedDate = now;
  document.updatedAt = Date.now();
  document.isFavorite = favorite;
  putDocument(document);
}

export function removeHistory(id) {
  host.db.remove(id);
}

let routeSeed = 0;
export function createRouteId() {
  routeSeed += 1;
  return `route-${Date.now().toString(36)}-${routeSeed}`;
}

// 把旧版 apiProxy 数组整个搬过来。老实现只挑 isOpen 那一条、其余直接丢弃，
// 用户配过的多条线路就是这样丢的——这里全部保留。
export function routesFromLegacy(legacy) {
  const entries = Array.isArray(legacy) ? legacy : [legacy];
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

export function activeRoute(settings) {
  const routes = settings?.apiRoutes || [];
  return routes.find((route) => route.id === settings.activeRouteId) || routes[0] || null;
}

// provider/baseUrl/apiKey 作为当前线路的镜像字段保留，
// 这样 streamChat 和各处的「是否已配置」判断都不用改。
export function syncActiveRoute(settings) {
  const route = activeRoute(settings);
  if (!route) return settings;
  settings.activeRouteId = route.id;
  settings.provider = route.provider || 'openai';
  settings.baseUrl = route.baseUrl || '';
  settings.apiKey = route.apiKey || '';
  return settings;
}

function ensureRoutes(settings) {
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

export function loadSettings() {
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

export function saveSettings(settings) {
  host.dbStorage.setItem(SETTINGS_KEY, clonePlain(settings));
}
