import { clonePlain } from './plain-clone.ts';

// 浏览器调试用的文档库键名。注意不要和 dbStorage 的 `funchat.` 前缀拼出同一个键，
// 否则 db 与 dbStorage 会互相覆盖，测试就会在生产不存在的路径上通过。
const STORAGE_KEY = 'funchat.db.documents';

export type StorageDocument = Record<string, any> & { _id: string; _rev?: string };

export type DbResult = {
  ok?: true;
  id?: string;
  rev?: string;
  error?: true;
  name?: string;
  message?: string;
};

export type UtoolsDb = {
  put(document: StorageDocument): DbResult;
  get(id: string): StorageDocument | null;
  remove(document: StorageDocument | string): DbResult;
  allDocs(prefix?: string): StorageDocument[];
  promises: {
    put(document: StorageDocument): Promise<DbResult>;
    get(id: string): Promise<StorageDocument | null>;
    remove(document: StorageDocument | string): Promise<DbResult>;
    allDocs(prefix?: string): Promise<StorageDocument[]>;
  };
};

export type AiChunk = { content?: string; reasoning_content?: string };
export type AiRequest = Promise<unknown> & { abort?: () => void };

export type UtoolsHost = Record<string, any> & {
  db: UtoolsDb;
  dbStorage: {
    getItem(key: string): any;
    setItem(key: string, value: unknown): void;
    removeItem(key: string): void;
  };
  ai?: ((params: Record<string, unknown>, onChunk: (chunk?: AiChunk) => void) => AiRequest) | null;
  /** uTools AI 的可用模型清单，老版本客户端上可能不存在。 */
  allAiModels?: () => Promise<unknown>;
  copyText(text: string): unknown;
  copyImage(dataUrl: string): unknown;
  shellOpenExternal(url: string): unknown;
};

type WebStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function createWebStorage(): WebStorage {
  if (globalThis.localStorage) return globalThis.localStorage;
  const memory = new Map<string, string>();
  return {
    getItem: (key) => (memory.has(key) ? (memory.get(key) as string) : null),
    setItem: (key, value) => { memory.set(key, String(value)); },
    removeItem: (key) => { memory.delete(key); },
  };
}

function revisionOf(document: StorageDocument | undefined): string | undefined {
  return document?._rev || undefined;
}

function createBrowserDb(storage: WebStorage): UtoolsDb {
  const readDocs = (): Map<string, StorageDocument> => new Map(Object.entries(JSON.parse(storage.getItem(STORAGE_KEY) || '{}')));
  const writeDocs = (docs: Map<string, StorageDocument>) => storage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(docs)));

  const db = {
    put(document: StorageDocument): DbResult {
      const docs = readDocs();
      const previous = docs.get(document._id);
      // 和真机 db 一样校验 _rev：过期的写入必须报冲突，不能静默覆盖别处的改动
      if (revisionOf(previous) !== revisionOf(document)) {
        return { id: document._id, error: true, name: 'conflict', message: 'Document update conflict' };
      }
      const next = clonePlain(document);
      next._rev = `${Number.parseInt(String(previous?._rev), 10) + 1 || 1}-browser`;
      docs.set(next._id, next);
      writeDocs(docs);
      return { ok: true, id: next._id, rev: next._rev };
    },
    get(id: string): StorageDocument | null {
      return clonePlain(readDocs().get(id) || null);
    },
    remove(document: StorageDocument | string): DbResult {
      const id = typeof document === 'string' ? document : document?._id;
      const docs = readDocs();
      docs.delete(id);
      writeDocs(docs);
      return { ok: true, id };
    },
    allDocs(prefix = ''): StorageDocument[] {
      return [...readDocs().values()].filter((item) => item._id.startsWith(prefix)).map(clonePlain);
    },
  };

  return {
    ...db,
    promises: {
      put: async (document) => db.put(document),
      get: async (id) => db.get(id),
      remove: async (document) => db.remove(document),
      allDocs: async (prefix) => db.allDocs(prefix),
    },
  };
}

function createBrowserUtools(): UtoolsHost {
  const storage = createWebStorage();

  return {
    db: createBrowserDb(storage),
    dbStorage: {
      getItem: (key) => JSON.parse(storage.getItem(`funchat.${key}`) || 'null'),
      setItem: (key, value) => storage.setItem(`funchat.${key}`, JSON.stringify(value)),
      removeItem: (key) => storage.removeItem(`funchat.${key}`),
    },
    getUser: () => ({ nickname: '本地用户', avatar: '' }),
    onPluginEnter: (callback: (action: unknown) => void) => callback({ code: 'funchat', type: 'text', payload: '' }),
    onPluginDetach: () => {},
    copyText: (text: string) => navigator.clipboard?.writeText(text),
    // 浏览器调试时也让「复制为图片」真的能用，而不是静默失败
    copyImage: async (dataUrl: string) => {
      if (typeof ClipboardItem !== 'function' || !navigator.clipboard?.write) return;
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    },
    getPath: () => '',
    showSaveDialog: () => null,
    shellOpenExternal: (url: string) => window.open(url, '_blank', 'noopener'),
    ai: null,
  };
}

export const host: UtoolsHost = globalThis.utools || createBrowserUtools();
globalThis.utools ||= host;
