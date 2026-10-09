import { host } from './utools.ts';
import type { AiChunk, UtoolsHost } from './utools.ts';

type AiInvoker = NonNullable<UtoolsHost['ai']>;
type ChatMessage = { role?: string; content?: unknown };
type ChatParams = Record<string, unknown> & { model?: string; messages: ChatMessage[]; stream: boolean; max_tokens?: number };
type StreamChatOptions = {
  settings: { provider?: string; baseUrl?: string; apiKey?: string; model?: string };
  agent: { params?: Record<string, unknown> & { model?: string }; un_stream?: boolean };
  messages: ChatMessage[];
  signal?: AbortSignal;
  onDelta: (chunk: string) => void;
};

/**
 * 将用户配置的服务地址规范化为 OpenAI 聊天补全端点。
 * @param value 用户填写的基础地址或完整端点；末尾 `#` 表示禁止自动补全路径。
 * @returns 可请求的端点地址；空输入返回空字符串。
 */
export function normalizeChatUrl(value: unknown): string {
  const raw = String(value || '').trim();
  if (raw.endsWith('#')) return raw.slice(0, -1);
  const base = raw.replace(/\/$/u, '');
  if (!base) return '';
  if (base.endsWith('/chat/completions')) return base;
  return `${base.endsWith('/v1') ? base : `${base}/v1`}/chat/completions`;
}

function readChoice(payload: any): string {
  return payload?.choices?.[0]?.delta?.content
    ?? payload?.choices?.[0]?.message?.content
    ?? payload?.content
    ?? '';
}

/**
 * 判断文本块是否符合 Server-Sent Events 字段格式。
 * @param text 待检查的响应文本。
 * @returns 包含 SSE 字段时返回 `true`。
 */
export function isEventStream(text: string): boolean {
  return /^(?::|data:|event:|id:|retry:)/mu.test(text);
}

/**
 * 从 SSE 文本中提取聊天增量内容，忽略空事件和 `[DONE]` 标记。
 * @param text 一个或多个 SSE 事件组成的文本。
 * @returns 按出现顺序拼接的内容；无法解析的 data 行保留原文。
 */
export function parseEventStream(text: string): string {
  return text.split(/\r?\n/u).flatMap((line) => {
    if (!line.startsWith('data:')) return [];
    const value = line.slice(5).trim();
    if (!value || value === '[DONE]') return [];
    try {
      return [readChoice(JSON.parse(value))];
    } catch {
      return [value];
    }
  }).join('');
}

async function useUtoolsAi(ai: AiInvoker, params: ChatParams, onDelta: (chunk: string) => void, signal?: AbortSignal): Promise<void> {
  let thinking = false;
  const pending = ai(params, (chunk: AiChunk = {}) => {
    if (chunk.reasoning_content) {
      if (!thinking) onDelta(':::thinking\n');
      thinking = true;
      onDelta(chunk.reasoning_content);
    }
    if (chunk.content) {
      if (thinking) {
        onDelta('\n:::\n');
        thinking = false;
      }
      onDelta(chunk.content);
    }
  });
  const abort = pending?.abort?.bind(pending);
  if (signal && abort) {
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  }
  await pending;
}

/**
 * 通过 uTools AI 或用户配置的 OpenAI 兼容接口流式发送一次对话。
 * @param options 请求设置、角色参数、消息、取消信号和增量回调。
 * @returns 响应流消费完成后结束；配置缺失或远端请求失败时抛出错误。
 */
export async function streamChat({ settings, agent, messages, signal, onDelta }: StreamChatOptions): Promise<void> {
  const params: ChatParams = {
    ...agent.params,
    model: agent.params?.model || settings.model || 'gpt-4.1-mini',
    messages,
    stream: !agent.un_stream,
  };
  if (!params.max_tokens) delete params.max_tokens;

  const ai = host.ai;
  if (settings.provider === 'utools' && typeof ai === 'function') {
    await useUtoolsAi(ai, params, onDelta, signal);
    return;
  }

  const url = normalizeChatUrl(settings.baseUrl);
  if (!url) throw new Error('请先在设置中配置 OpenAI 兼容接口，或选择 uTools AI。');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
    },
    body: JSON.stringify(params),
    signal,
  });
  if (!response.ok) {
    const body = await response.text();
    try {
      throw new Error(JSON.parse(body).error?.message || body || `HTTP ${response.status}`);
    } catch (error) {
      throw error instanceof SyntaxError ? new Error(body || `HTTP ${response.status}`) : error;
    }
  }

  if (response.headers.get('content-type')?.includes('application/json')) {
    onDelta(readChoice(await response.json()));
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('服务端没有返回可读取的响应');
  const decoder = new TextDecoder();
  let pending = '';
  while (true) {
    const { done, value } = await reader.read();
    pending += decoder.decode(value || new Uint8Array(), { stream: !done });
    const parts = pending.split(/\r?\n\r?\n/u);
    pending = parts.pop() || '';
    for (const part of parts) onDelta(isEventStream(part) ? parseEventStream(part) : part);
    if (done) break;
  }
  if (pending) onDelta(isEventStream(pending) ? parseEventStream(pending) : pending);
}
