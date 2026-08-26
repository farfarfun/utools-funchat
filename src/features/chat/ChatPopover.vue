<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useChatStore } from '../../stores/chat.js';

const props = defineProps({ kind: { type: String, required: true } });
const emit = defineEmits(['close']);
const store = useChatStore();

function paramValue(value, fallback) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/* ---------- API 线路 ---------- */

const tab = ref('routes');
const routes = computed(() => store.state.settings.apiRoutes || []);
const editingId = ref(store.state.settings.activeRouteId || routes.value[0]?.id || '');

const blankRoute = () => ({ id: '', name: '', provider: 'openai', baseUrl: '', apiKey: '', streamMode: 'client' });
const draft = reactive(blankRoute());

function loadDraft(routeId) {
  const route = routes.value.find((item) => item.id === routeId);
  Object.assign(draft, route ? { ...blankRoute(), ...route } : blankRoute());
}
loadDraft(editingId.value);
watch(editingId, loadDraft);

function editRoute(routeId) {
  editingId.value = routeId;
}

function addRoute() {
  editingId.value = '';
  Object.assign(draft, blankRoute());
}

function saveRoute() {
  if (draft.provider !== 'utools' && !draft.baseUrl.trim()) return;
  const saved = {
    id: draft.id,
    name: draft.name.trim() || (draft.provider === 'utools' ? 'uTools AI' : '未命名线路'),
    provider: draft.provider,
    baseUrl: draft.baseUrl.trim(),
    apiKey: draft.apiKey.trim(),
    streamMode: draft.streamMode,
  };
  store.saveApiRoute(saved);
  editingId.value = store.state.settings.activeRouteId;
  emit('close');
}

function deleteRoute(routeId) {
  store.removeApiRoute(routeId);
  editingId.value = store.state.settings.activeRouteId || '';
  loadDraft(editingId.value);
}

function useRoute(routeId) {
  store.selectApiRoute(routeId);
  editingId.value = routeId;
}

/* ---------- 临时调参 ---------- */

const params = reactive({
  model: store.state.currentAgent?.params?.model || '',
  contextLength: Number(store.state.currentAgent?.contextLength) || 16,
  max_tokens: paramValue(store.state.currentAgent?.params?.max_tokens, 900),
  temperature: paramValue(store.state.currentAgent?.params?.temperature, 0.6),
  top_p: paramValue(store.state.currentAgent?.params?.top_p, 1),
  frequency_penalty: paramValue(store.state.currentAgent?.params?.frequency_penalty, 0),
  presence_penalty: paramValue(store.state.currentAgent?.params?.presence_penalty, 0),
});

const modelOptions = computed(() => [...new Set(store.state.agents.map((agent) => agent.params?.model).filter(Boolean))]);
const modelOpen = ref(false);
// 输入即筛选；没匹配上就把完整列表摆出来，避免用户打错字后看到空下拉以为坏了
const modelMatches = computed(() => {
  const keyword = params.model.trim().toLowerCase();
  if (!keyword) return modelOptions.value;
  const hits = modelOptions.value.filter((model) => model.toLowerCase().includes(keyword));
  return hits.length ? hits : modelOptions.value;
});

function pickModel(model) {
  params.model = model;
  modelOpen.value = false;
  saveParams();
}

const parameterRows = [
  { key: 'contextLength', label: '上下文数', min: 2, max: 36, step: 1 },
  { key: 'max_tokens', label: '最大回复', min: 0, max: 16384, step: 1 },
  { key: 'temperature', label: '随机性', min: 0, max: 2, step: 0.1 },
  { key: 'top_p', label: '核采样', min: 0, max: 1, step: 0.1 },
  { key: 'frequency_penalty', label: '频率惩罚', min: -2, max: 2, step: 0.1 },
  { key: 'presence_penalty', label: '存在惩罚', min: -2, max: 2, step: 0.1 },
];

function saveParams() {
  const agent = store.state.currentAgent;
  if (!agent) return;
  agent.contextLength = params.contextLength;
  Object.assign(agent.params, {
    model: params.model.trim(),
    max_tokens: params.max_tokens,
    temperature: params.temperature,
    top_p: params.top_p,
    frequency_penalty: params.frequency_penalty,
    presence_penalty: params.presence_penalty,
  });
}

function rangeStyle(row) {
  return { '--range-progress': `${((params[row.key] - row.min) / (row.max - row.min)) * 100}%` };
}
</script>

<template>
  <section v-if="props.kind === 'api'" class="chat-popover api-popover" role="dialog" aria-label="API路线管理">
    <nav class="api-tabs" aria-label="API设置分类">
      <button type="button" :class="{ active: tab === 'routes' }" @click="tab = 'routes'">API路线管理</button>
      <button type="button" :class="{ active: tab === 'notice' }" @click="tab = 'notice'">服务声明</button>
    </nav>

    <div v-if="tab === 'routes'" class="route-layout">
      <aside class="route-list" aria-label="已保存的线路">
        <button
          v-for="route in routes"
          :key="route.id"
          type="button"
          class="route-item"
          :class="{ editing: route.id === editingId, active: route.id === store.state.settings.activeRouteId }"
          @click="editRoute(route.id)"
        >
          <span class="route-dot" aria-hidden="true"></span>
          <span class="route-meta">
            <b>{{ route.name || '未命名线路' }}</b>
            <small>{{ route.provider === 'utools' ? 'uTools AI' : (route.baseUrl || '未填地址') }}</small>
          </span>
          <span v-if="route.id === store.state.settings.activeRouteId" class="route-badge">使用中</span>
        </button>
        <p v-if="!routes.length" class="route-empty">还没有线路，右侧填一条</p>
        <button type="button" class="route-add" @click="addRoute">＋ 新增线路</button>
      </aside>

      <form class="api-form" @submit.prevent="saveRoute">
        <label class="form-row required">
          <span>API路线</span>
          <span class="select-control">
            <select v-model="draft.provider">
              <option value="openai">私有API路线</option>
              <option value="utools">uTools AI</option>
            </select>
            <i class="iconfont icon-down" aria-hidden="true"></i>
          </span>
        </label>
        <label class="form-row"><span>API别名</span><input v-model="draft.name" placeholder="随意起个别名，方便记忆"></label>
        <label v-if="draft.provider !== 'utools'" class="form-row api-url required">
          <span>API地址</span>
          <input v-model="draft.baseUrl" placeholder="示例: https://api.gpt.ge 或完整.../completions路径">
          <small>若不希望API被自动拼接.../chat/completions后缀，请添加#后缀</small>
        </label>
        <div v-if="draft.provider !== 'utools'" class="form-row stream-row">
          <span>流解析</span>
          <div>
            <label><input v-model="draft.streamMode" type="radio" value="client">插件端解析流（默认）</label>
            <label><input v-model="draft.streamMode" type="radio" value="server">服务端解析流</label>
          </div>
        </div>
        <label v-if="draft.provider !== 'utools'" class="form-row">
          <span>KEY秘钥</span>
          <input v-model="draft.apiKey" type="password" autocomplete="off" placeholder="请复制或输入KEY秘钥（令牌）到这里">
        </label>
        <footer>
          <button v-if="draft.id && draft.id !== store.state.settings.activeRouteId" type="button" class="route-use" @click="useRoute(draft.id)">设为当前</button>
          <button v-if="draft.id" type="button" class="route-delete" @click="deleteRoute(draft.id)">删除</button>
          <button class="save-api" type="submit">{{ draft.id ? '保存线路' : '添加线路' }}</button>
        </footer>
      </form>
    </div>

    <div v-else class="service-notice">
      <p>本插件仅限个人学习及体验 AI 成果，请勿用于任何违法行为。因使用本插件产生的一切后果，均由使用者自行承担。</p>
      <h3>关于私有API路线</h3><p>适配 OpenAI 兼容接口，可保存多条地址与密钥并随时切换。</p>
      <h3>关于 uTools AI</h3><p>使用客户端内置 AI 能力，无需额外填写 API 地址。</p>
    </div>
  </section>

  <section v-else class="chat-popover params-popover" role="dialog" aria-label="临时调参">
    <header><b>临时调参</b><small>发起新话题后失效</small><span>ⓘ 永久保存模型方法</span></header>
    <label class="model-row">
      <b>模型选择</b>
      <span class="model-control">
        <input
          v-model="params.model"
          placeholder="请选择或新建模型 ..."
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="modelOpen"
          @focus="modelOpen = true"
          @input="modelOpen = true"
          @change="saveParams"
          @keydown.esc.stop="modelOpen = false"
        >
        <button type="button" class="model-toggle" :aria-label="modelOpen ? '收起模型列表' : '展开模型列表'" @mousedown.prevent="modelOpen = !modelOpen">
          <i class="iconfont icon-down" :class="{ flipped: modelOpen }" aria-hidden="true"></i>
        </button>
        <!-- mousedown.prevent 保证点选项时输入框不先失焦，否则列表会在 click 之前就关掉 -->
        <ul v-if="modelOpen && modelMatches.length" class="model-menu" role="listbox">
          <li v-for="model in modelMatches" :key="model" role="option" :aria-selected="model === params.model">
            <button type="button" :class="{ chosen: model === params.model }" @mousedown.prevent="pickModel(model)">{{ model }}</button>
          </li>
        </ul>
        <small>注意：也支持手动输入模型名称，注意大小写。</small>
      </span>
    </label>
    <label v-for="row in parameterRows" :key="row.key" class="parameter-row"><span>{{ row.label }} <small>ⓘ</small></span><input v-model.number="params[row.key]" type="range" :min="row.min" :max="row.max" :step="row.step" :style="rangeStyle(row)" @input="saveParams"><input v-model.number="params[row.key]" class="parameter-number" type="number" :min="row.min" :max="row.max" :step="row.step" @change="saveParams"></label>
  </section>
</template>

<style scoped>
.chat-popover { position: absolute; z-index: 80; right: 0; bottom: 159px; color: var(--color-text-2); background: var(--color-bg-2); border: 1px solid var(--color-border-2); border-radius: 8px 0 0 8px; box-shadow: 0 4px 10px #0000001a; line-height: 22px; }
.api-popover { width: 620px; height: 378px; padding-bottom: 12px; }
.api-tabs { height: 44px; padding: 0 8px; display: flex; align-items: stretch; border-bottom: 1px solid var(--color-border-2); }
.api-tabs button { position: relative; height: 40px; margin: 0 10px; color: var(--color-text-1); }
.api-tabs button.active { color: var(--color-primary); }
.api-tabs button.active::after { content: ""; position: absolute; right: 0; bottom: -1px; left: 0; height: 2px; background: var(--color-primary); }

.route-layout { height: 322px; display: flex; }
.route-list { width: 176px; padding: 10px 8px; display: flex; flex-direction: column; gap: 4px; flex: 0 0 176px; overflow-y: auto; border-right: 1px solid var(--color-border-2); }
.route-item { display: flex; align-items: center; gap: 8px; padding: 7px 9px; border-radius: 8px; text-align: left; }
.route-item:hover { background: var(--color-fill-1); }
.route-item.editing { background: var(--color-fill-2); }
.route-dot { width: 6px; height: 6px; flex: 0 0 6px; border-radius: 50%; background: var(--color-border-2); }
.route-item.active .route-dot { background: var(--color-primary); }
.route-meta { min-width: 0; display: flex; flex-direction: column; flex: 1; }
.route-meta b { overflow: hidden; color: var(--color-text-1); font-size: 13px; font-weight: 500; line-height: 20px; text-overflow: ellipsis; white-space: nowrap; }
.route-meta small { overflow: hidden; color: var(--color-text-3); font-size: 11px; line-height: 16px; text-overflow: ellipsis; white-space: nowrap; }
.route-badge { flex: 0 0 auto; padding: 0 5px; border-radius: 8px; color: var(--color-primary); background: var(--color-primary-light-1); font-size: 10px; line-height: 16px; }
.route-empty { padding: 12px 9px; color: var(--color-text-3); font-size: 12px; }
.route-add { margin-top: auto; padding: 7px; flex: 0 0 auto; border: 1px dashed var(--color-border-2); border-radius: 8px; color: var(--color-text-2); font-size: 12px; }
.route-add:hover { border-color: var(--color-primary); color: var(--color-primary); }

.api-form { min-width: 0; padding: 18px 20px 8px; display: flex; flex: 1; flex-direction: column; }
.form-row { min-height: 32px; margin-bottom: 12px; display: flex; align-items: center; }
.form-row > span:first-child { width: 62px; flex: 0 0 62px; padding-right: 10px; text-align: right; }
.form-row.required > span:first-child::before { content: "*"; margin-right: 3px; color: #f53f3f; }
.form-row > input, .select-control { min-width: 0; height: 32px; padding: 0 13px; flex: 1; border: 1px solid transparent; border-radius: 12px; outline: 0; background: var(--color-fill-2); }
.form-row > input:focus, .select-control:focus-within { border-color: var(--color-primary); background: var(--color-bg-2); }
.select-control { position: relative; padding: 0; }
.select-control select { width: 100%; height: 30px; padding: 0 34px 0 13px; appearance: none; border: 0; outline: 0; color: inherit; background: transparent; }
.select-control i { position: absolute; top: 6px; right: 13px; color: var(--color-icon); font-size: 12px; pointer-events: none; }
.api-url { position: relative; margin-bottom: 32px; }
.api-url small { position: absolute; top: 32px; left: 62px; color: var(--color-text-3); font-size: 12px; }
.stream-row > div { height: 32px; display: flex; align-items: center; gap: 20px; }
.stream-row label { display: flex; align-items: center; gap: 8px; }
.stream-row input { width: 14px; height: 14px; accent-color: var(--color-primary); }
.api-form footer { height: 32px; margin-top: auto; display: flex; gap: 8px; }
.api-form footer button { height: 32px; padding: 0 12px; border-radius: 12px; }
.route-use { background: var(--color-fill-2); }
.route-use:hover { color: var(--color-primary); }
.route-delete { color: #f53f3f; background: var(--color-fill-2); }
.save-api { flex: 1; color: #fff; background: var(--color-primary); }
.service-notice { height: 310px; padding: 18px 20px; overflow-y: auto; font-size: 13px; }
.service-notice > p:first-child { padding: 12px; border-radius: 12px; background: var(--color-primary-light-1); }
.service-notice h3 { margin: 16px 0 4px; font-size: 14px; }

.params-popover { width: 552px; height: 394px; padding: 14px 16px 16px; }
.params-popover header { height: 34px; display: flex; align-items: flex-start; }
.params-popover header b { color: var(--color-text-1); font-weight: 500; }
.params-popover header small { margin-left: 8px; color: #f759ab; font-size: 12px; }
.params-popover header span { margin-left: auto; color: var(--color-text-3); font-size: 12px; }
.model-row { height: 62px; display: flex; align-items: flex-start; }
.model-row > b { width: 90px; padding-top: 7px; font-weight: 400; text-align: right; }
.model-control { position: relative; min-width: 0; margin-left: 18px; flex: 1; }
.model-control > input { width: 100%; height: 32px; padding: 0 34px 0 13px; border: 1px solid transparent; border-radius: 12px; outline: 0; background: var(--color-fill-2); }
.model-control > input:focus { border-color: var(--color-primary); background: var(--color-bg-2); }
.model-toggle { position: absolute; top: 0; right: 0; width: 34px; height: 32px; display: grid; place-items: center; color: var(--color-icon); }
.model-toggle .flipped { display: inline-block; transform: rotate(180deg); }
.model-menu { position: absolute; z-index: 10; top: 36px; right: 0; left: 0; max-height: 176px; padding: 4px; overflow-y: auto; border: 1px solid var(--color-border-2); border-radius: 12px; background: var(--color-bg-2); box-shadow: 0 6px 16px #00000024; }
.model-menu button { width: 100%; padding: 0 10px; border-radius: 8px; color: var(--color-text-1); font-size: 13px; line-height: 30px; text-align: left; }
.model-menu button:hover { background: var(--color-fill-1); }
.model-menu button.chosen { color: var(--color-primary); background: var(--color-primary-light-1); }
.model-control > small { display: block; color: var(--color-text-3); font-size: 12px; }
.parameter-row { height: 44px; display: flex; align-items: center; }
.parameter-row > span { width: 90px; flex: 0 0 90px; color: var(--color-text-1); }
.parameter-row > span small { color: #b7bdc7; font-size: 11px; }
.parameter-row input[type="range"] { min-width: 0; height: 18px; margin: 0 20px 0 0; flex: 1; appearance: none; background: transparent; }
.parameter-row input[type="range"]::-webkit-slider-runnable-track { height: 2px; background: linear-gradient(to right, var(--color-primary) 0 var(--range-progress), var(--color-border-2) var(--range-progress) 100%); }
.parameter-row input[type="range"]::-webkit-slider-thumb { width: 12px; height: 12px; margin-top: -5px; appearance: none; border: 2px solid var(--color-primary); border-radius: 50%; background: var(--color-bg-2); }
.parameter-number { width: 80px; height: 32px; padding: 0 12px; border: 0; border-radius: 3px; outline: 0; background: var(--color-fill-2); text-align: center; }
.parameter-number::-webkit-inner-spin-button, .parameter-number::-webkit-outer-spin-button { appearance: none; margin: 0; }
</style>
