import { clonePlain } from './plain-clone.js';

const STORAGE_KEY = 'funchat.browser.db';

function createWebStorage() {
  if (globalThis.localStorage) return globalThis.localStorage;
  const memory = new Map();
  return {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key),
  };
}

function createBrowserUtools() {
  const localStorage = createWebStorage();
  const readDocs = () => new Map(Object.entries(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')));
  const writeDocs = (docs) => localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(docs)));
  const db = {
    put(document) {
      const docs = readDocs();
      const next = clonePlain(document);
      next._rev = `${Number.parseInt(next._rev, 10) + 1 || 1}-browser`;
      docs.set(next._id, next);
      writeDocs(docs);
      return { ok: true, id: next._id, rev: next._rev };
    },
    get(id) {
      return clonePlain(readDocs().get(id) || null);
    },
    remove(document) {
      const docs = readDocs();
      docs.delete(document?._id || document);
      writeDocs(docs);
      return { ok: true };
    },
    allDocs(prefix = '') {
      return [...readDocs().values()].filter((item) => item._id.startsWith(prefix)).map(clonePlain);
    },
  };
  db.promises = {
    put: async (document) => db.put(document),
    get: async (id) => db.get(id),
    remove: async (document) => db.remove(document),
    allDocs: async (prefix) => db.allDocs(prefix),
  };

  return {
    db,
    dbStorage: {
      getItem: (key) => JSON.parse(localStorage.getItem(`funchat.${key}`) || 'null'),
      setItem: (key, value) => localStorage.setItem(`funchat.${key}`, JSON.stringify(value)),
      removeItem: (key) => localStorage.removeItem(`funchat.${key}`),
    },
    getUser: () => ({ nickname: '本地用户', avatar: '' }),
    onPluginEnter: (callback) => callback({ code: 'funchat', type: 'text', payload: '' }),
    onPluginDetach: () => {},
    copyText: (text) => navigator.clipboard?.writeText(text),
    copyImage: () => {},
    getPath: () => '',
    showSaveDialog: () => null,
    shellOpenExternal: (url) => window.open(url, '_blank', 'noopener'),
    ai: null,
  };
}

export const host = globalThis.utools || createBrowserUtools();
globalThis.utools ||= host;
