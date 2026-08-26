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

  const order = host.dbStorage.getItem('sortAiIds') || [];
  return documents.map(decodeAgent).sort((left, right) => {
    if (Boolean(left.is_top) !== Boolean(right.is_top)) return left.is_top ? -1 : 1;
    const leftIndex = order.indexOf(left._id);
    const rightIndex = order.indexOf(right._id);
    return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex);
  });
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
  document.isFavorite = favorite;
  putDocument(document);
}

export function removeHistory(id) {
  host.db.remove(id);
}

export function loadSettings() {
  const stored = host.dbStorage.getItem(SETTINGS_KEY);
  if (stored) return { ...stored, theme: stored.theme || (stored.dark ? 'dark' : 'system') };
  const legacy = host.dbStorage.getItem('apiProxy');
  const active = (Array.isArray(legacy) ? legacy : [legacy]).find((item) => item?.isOpen);
  return {
    provider: active?.value === 200 ? 'utools' : 'openai',
    baseUrl: active?.url || '',
    apiKey: active?.apiKey || '',
    model: 'gpt-4.1-mini',
    theme: host.dbStorage.getItem('isDark') ? 'dark' : 'system',
    dark: host.dbStorage.getItem('isDark') || false,
  };
}

export function saveSettings(settings) {
  host.dbStorage.setItem(SETTINGS_KEY, clonePlain(settings));
}
