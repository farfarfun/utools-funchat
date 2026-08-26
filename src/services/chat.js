import { host } from './utools.js';

export function normalizeChatUrl(value) {
  const raw = String(value || '').trim();
  if (raw.endsWith('#')) return raw.slice(0, -1);
  const base = raw.replace(/\/$/u, '');
  if (!base) return '';
  if (base.endsWith('/chat/completions')) return base;
  return `${base.endsWith('/v1') ? base : `${base}/v1`}/chat/completions`;
}

function readChoice(payload) {
  return payload?.choices?.[0]?.delta?.content
    ?? payload?.choices?.[0]?.message?.content
    ?? payload?.content
    ?? '';
}

export function isEventStream(text) {
  return /^(?::|data:|event:|id:|retry:)/mu.test(text);
}

export function parseEventStream(text) {
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

async function useUtoolsAi(params, onDelta, signal) {
  let thinking = false;
  const pending = host.ai(params, (chunk = {}) => {
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
  if (signal && typeof pending?.abort === 'function') {
    if (signal.aborted) pending.abort();
    else signal.addEventListener('abort', () => pending.abort(), { once: true });
  }
  await pending;
}

export async function streamChat({ settings, agent, messages, signal, onDelta }) {
  const params = {
    ...agent.params,
    model: agent.params?.model || settings.model || 'gpt-4.1-mini',
    messages,
    stream: !agent.un_stream,
  };
  if (!params.max_tokens) delete params.max_tokens;

  if (settings.provider === 'utools' && typeof host.ai === 'function') {
    await useUtoolsAi(params, onDelta, signal);
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
