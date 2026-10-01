export const OPTIONAL_PARAM_DEFAULTS = {
  max_tokens: 0,
  temperature: 0.6,
  top_p: 1,
  presence_penalty: 0,
  frequency_penalty: 0,
};

const FORM_DEFAULTS = {
  group: '',
  model: '',
  type: 'prompt',
  nickname: '',
  info: '',
  content: '',
  prompt: '',
  functions: '',
  callback: '',
  isAiSummary: false,
  autoPrefix: '',
  isFly: false,
  isOverall: false,
  isFlyNewChat: true,
  status: '',
  contextLength: 16,
  ...OPTIONAL_PARAM_DEFAULTS,
  quick_questions: [],
  isFollowQuestion: false,
  api_id: '',
  un_stream: false,
};

export function agentFormValues(agent) {
  const values = { ...FORM_DEFAULTS, quick_questions: [] };
  if (!agent) return values;
  for (const [key, fallback] of Object.entries(OPTIONAL_PARAM_DEFAULTS)) {
    values[key] = Number(agent.params?.[key] ?? fallback);
  }
  return Object.assign(values, {
    model: agent.params?.model || '',
    type: agent.isFunAi || agent.params?.functions ? 'function' : 'prompt',
    nickname: agent.nickname || '',
    info: agent.info || '',
    content: agent.content || '',
    prompt: agent.params?.messages?.[0]?.role === 'system' ? agent.params.messages[0].content || '' : '',
    functions: agent.params?.functions ? JSON.stringify(agent.params.functions, null, 2) : '',
    callback: agent.callback || '',
    isAiSummary: Boolean(agent.isAiSummary),
    autoPrefix: agent.autoPrefix || '',
    isFly: Boolean(agent.isFly),
    isOverall: Boolean(agent.isOverall),
    isFlyNewChat: agent.isFlyNewChat !== false,
    status: agent.status ?? '',
    contextLength: Number(agent.contextLength) || 16,
    quick_questions: [...(agent.quick_questions || [])],
    isFollowQuestion: Boolean(agent.isFollowQuestion),
    api_id: agent.api_id || '',
    un_stream: Boolean(agent.un_stream),
  });
}

export function writeOptionalParams(target, original, values) {
  for (const [key, fallback] of Object.entries(OPTIONAL_PARAM_DEFAULTS)) {
    const next = Number(values[key]);
    if (!Number.isFinite(next)) continue;
    if (key in (original || {}) || next !== fallback) target[key] = next;
    else delete target[key];
  }
}
