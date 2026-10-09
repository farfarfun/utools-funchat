import { host } from './utools.ts';

type ModelSource = { provider?: string; baseUrl?: string; apiKey?: string };

/**
 * 把用户填的服务地址规范化为 OpenAI 兼容的模型列表端点。
 * 和 normalizeChatUrl 处理同一份输入，但要落到 /models 而不是 /chat/completions。
 * @param value 用户填写的基础地址或完整端点；末尾 `#` 表示他已给出完整路径。
 * @returns 可请求的模型列表地址；空输入返回空字符串。
 */
export function normalizeModelsUrl(value: unknown): string {
  const raw = String(value || '').trim().replace(/#$/u, '');
  const base = raw.replace(/\/+$/u, '');
  if (!base) return '';
  // 填的是聊天端点时换成同级的 models，而不是在后面继续拼
  if (base.endsWith('/chat/completions')) return `${base.slice(0, -'/chat/completions'.length)}/models`;
  if (base.endsWith('/models')) return base;
  return `${base.endsWith('/v1') ? base : `${base}/v1`}/models`;
}

/**
 * 从模型列表响应里取出模型 id。
 * 不同中转站返回的包装各不相同，常见的三种都认：
 * `{ data: [{ id }] }`（OpenAI 官方）、`{ models: [...] }`、以及裸数组。
 * @param payload 已解析的响应体。
 * @returns 去重并排序后的模型 id 列表。
 */
export function parseModelList(payload: unknown): string[] {
  const source = Array.isArray(payload)
    ? payload
    : (payload as { data?: unknown[]; models?: unknown[] })?.data
      ?? (payload as { models?: unknown[] })?.models
      ?? [];
  if (!Array.isArray(source)) return [];
  const ids = source
    .map((item) => (typeof item === 'string' ? item : String((item as { id?: unknown; name?: unknown })?.id ?? (item as { name?: unknown })?.name ?? '')))
    .map((id) => id.trim())
    .filter(Boolean);
  return [...new Set(ids)].sort((left, right) => left.localeCompare(right));
}

async function fetchFromOpenAi({ baseUrl, apiKey }: ModelSource): Promise<string[]> {
  const url = normalizeModelsUrl(baseUrl);
  if (!url) throw new Error('请先填写 API 地址');
  const response = await fetch(url, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  });
  if (!response.ok) {
    const body = await response.text();
    let message = body || `HTTP ${response.status}`;
    try {
      message = JSON.parse(body).error?.message || message;
    } catch { /* 非 JSON 响应就用原文 */ }
    throw new Error(`拉取模型失败：${message}`);
  }
  const models = parseModelList(await response.json());
  if (!models.length) throw new Error('接口返回的模型列表是空的');
  return models;
}

/**
 * 拉取一条线路可用的模型列表。
 * @param source 线路的 provider、地址与密钥。
 * @returns 模型 id 列表；地址缺失、请求失败或列表为空时抛出错误。
 */
export async function fetchModels(source: ModelSource): Promise<string[]> {
  if (source.provider !== 'utools') return fetchFromOpenAi(source);
  // uTools AI 的可用模型由客户端给出，没有 HTTP 端点可问
  const all = await host.allAiModels?.();
  const models = parseModelList(all);
  if (!models.length) throw new Error('当前 uTools 版本没有提供可用模型列表');
  return models;
}
