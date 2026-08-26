<script setup>
import { computed, reactive, ref } from 'vue';
import { useChatStore } from '../../stores/chat.js';
import { agentFormValues } from './agent-form.js';
import AgentAvatar from './AgentAvatar.vue';

const store = useChatStore();
const dialog = ref();
const editing = ref(null);
const tab = ref('basic');
const question = ref('');
const form = reactive({});

const previewAgent = computed(() => ({
  nickname: form.nickname || 'AI',
  avatar: editing.value?.avatar || { type: 'icon', icon: 'icon-a1', color: '#0ca47f' },
}));
const modelOptions = computed(() => [...new Set(store.state.agents.map((agent) => agent.params?.model).filter(Boolean))]);
const parameterRows = [
  { key: 'contextLength', label: '上下文数', min: 2, max: 36, step: 1 },
  { key: 'max_tokens', label: '最大回复', min: 0, max: 16384, step: 1 },
  { key: 'temperature', label: '随机属性', min: 0, max: 2, step: 0.1 },
  { key: 'top_p', label: '词汇属性', min: 0, max: 1, step: 0.1 },
  { key: 'presence_penalty', label: '话题属性', min: -2, max: 2, step: 0.1 },
  { key: 'frequency_penalty', label: '重复属性', min: -2, max: 2, step: 0.1 },
];

function open(agent = null) {
  editing.value = agent;
  Object.assign(form, agentFormValues(agent));
  question.value = '';
  tab.value = 'basic';
  dialog.value.showModal();
  dialog.value.focus();
}

function submit() {
  if (!form.nickname.trim()) return;
  let paramsFunctions;
  try {
    paramsFunctions = form.type === 'function' && form.functions.trim() ? JSON.parse(form.functions) : undefined;
  } catch {
    tab.value = 'basic';
    return;
  }
  const values = { ...form, paramsFunctions };
  if (editing.value) store.updateAgent(editing.value, values);
  else store.addAgent(values);
  dialog.value.close();
}

function addQuestion() {
  const value = question.value.trim();
  if (!value) return;
  form.quick_questions.push(value);
  question.value = '';
}

function rangeStyle(row) {
  return { '--range-progress': `${((Number(form[row.key]) - row.min) / (row.max - row.min)) * 100}%` };
}

defineExpose({ open });
</script>

<template>
  <dialog ref="dialog" class="agent-dialog" :class="{ 'function-dialog': tab === 'basic' && form.type === 'function' }" tabindex="-1">
    <form method="dialog" @submit.prevent="submit">
      <div class="avatar-editor">
        <AgentAvatar :agent="previewAgent" :size="78" />
        <span class="avatar-edit" aria-hidden="true"><i class="iconfont icon-edit"></i></span>
      </div>

      <nav class="dialog-tabs" aria-label="好友设置分类">
        <button type="button" :class="{ active: tab === 'basic' }" @click="tab = 'basic'">基本设置</button>
        <button type="button" :class="{ active: tab === 'params' }" @click="tab = 'params'">参数调节</button>
        <button type="button" :class="{ active: tab === 'advanced' }" @click="tab = 'advanced'">高级设置</button>
      </nav>

      <section v-if="tab === 'basic'" class="dialog-pane basic-pane" :class="{ 'function-pane': form.type === 'function' }">
        <label class="form-row"><span>分组选择</span><span class="control select-control"><select v-model="form.group"><option value="">请选择分组，留空将使用默认分组...</option><option value="default">默认</option></select><i class="iconfont icon-down" aria-hidden="true"></i></span></label>
        <label class="form-row model-row"><span>模型选择</span><span class="control input-control"><input v-model="form.model" list="agent-model-options" placeholder="请选择或新建模型 ..."><i class="iconfont icon-down" aria-hidden="true"></i><small>注意：也支持手动输入模型名称，注意大小写。</small></span></label>
        <datalist id="agent-model-options"><option v-for="model in modelOptions" :key="model" :value="model"></option></datalist>
        <div class="form-row type-row"><span>类型</span><div class="radios"><label><input v-model="form.type" type="radio" value="prompt">指令型好友</label><label><input v-model="form.type" type="radio" value="function">函数型好友（<b>开发手册</b>）</label></div></div>
        <label class="form-row required"><span>昵称</span><input v-model="form.nickname" required maxlength="30" placeholder="Ai昵称"></label>
        <label class="form-row"><span>备注</span><input v-model="form.info" maxlength="60" placeholder="Ai信息备注"></label>
        <label class="form-row"><span>招呼</span><input v-model="form.content" placeholder="Ai招呼语或功能描述"></label>
        <template v-if="form.type === 'prompt'">
          <label class="form-row textarea-row"><span>角色指令</span><span class="control"><textarea v-model="form.prompt" rows="2" placeholder="指定Ai性格、角色、功能、指令等"></textarea><small>角色或指令需清晰易懂，明确且有逻辑。参考 <b>角色调教指南</b></small></span></label>
          <label class="form-row prefix-row"><span>提问前缀</span><span class="control"><input v-model="form.autoPrefix" placeholder="副指令，如：请翻译：xxx"><small>当指令无法满足需求时,可通过提问前缀(副指令)强制Ai执行。</small></span></label>
        </template>
        <template v-else>
          <label class="form-row function-row"><span>函数对象</span><span class="control"><textarea v-model="form.functions" rows="2" placeholder="传入函数Json对象。留空将跳过函数调用，直接将输入当作参数。"></textarea></span></label>
          <label class="form-row function-row"><span>函数回调</span><span class="control"><textarea v-model="form.callback" rows="2" placeholder="函数回调，请输入函数体。用法请阅开发手册"></textarea></span></label>
          <div class="form-row function-summary"><span>函数总结</span><div class="summary-control"><span class="switch"><input v-model="form.isAiSummary" type="checkbox" role="switch"><i></i></span><small>是否将函数结果经过Ai总结优化？(长内容建议关闭)</small></div></div>
        </template>
        <div class="form-row outside-row"><span>外部提问</span><div class="split-row"><label class="switch-label"><span class="switch"><input v-model="form.isFly" type="checkbox" role="switch"><i></i></span>快捷提问 <small>?</small></label><label class="switch-label"><span>全局提问</span><span class="switch"><input v-model="form.isOverall" type="checkbox" role="switch"><i></i></span><small>?</small></label></div></div>
        <div class="form-row outside-mode"><span>外部模式</span><div class="radios"><label><input v-model="form.isFlyNewChat" type="radio" :value="true">新话题提问</label><label><input v-model="form.isFlyNewChat" type="radio" :value="false">追加提问</label></div></div>
        <div class="form-row share-row"><span>分享状态</span><div class="radios status-radios"><label><input v-model="form.status" type="radio" :value="1">审核通过</label><label><input v-model="form.status" type="radio" :value="2">待审核</label><label><input v-model="form.status" type="radio" :value="3">审核失败</label><label><input v-model="form.status" type="radio" :value="0">下架</label></div></div>
      </section>

      <section v-else-if="tab === 'params'" class="dialog-pane params-pane">
        <label v-for="row in parameterRows" :key="row.key" class="parameter-row"><span>{{ row.label }} <small>?</small></span><input v-model.number="form[row.key]" type="range" :min="row.min" :max="row.max" :step="row.step" :style="rangeStyle(row)"><input v-model.number="form[row.key]" class="parameter-number" type="number" :min="row.min" :max="row.max" :step="row.step"></label>
        <p>参数留空则跟随全局设置，不会写入该好友。</p>
      </section>

      <section v-else class="dialog-pane advanced-pane">
        <label class="form-row question-row"><span>提问示例</span><span class="control tag-input"><span v-for="(item, index) in form.quick_questions" :key="`${item}-${index}`" class="question-tag">{{ item }}<button type="button" aria-label="删除提问示例" @click="form.quick_questions.splice(index, 1)">×</button></span><input v-model="question" placeholder="请输入问题示例，按回车添加" @keydown.enter.prevent="addQuestion"></span></label>
        <div class="form-row follow-row"><span>关联提问</span><div class="advanced-control"><div><span class="switch"><input v-model="form.isFollowQuestion" type="checkbox" role="switch"><i></i></span><button type="button">什么是关联提问？</button></div><small>关联提问默认使用便宜的gpt-4.1-mini模型。</small></div></div>
        <label class="form-row api-row"><span>API绑定</span><span class="control select-control"><select v-model="form.api_id"><option value="">可选择绑定某条API</option></select><i class="iconfont icon-down" aria-hidden="true"></i><small>（最高优先级）指定Ai使用某条API路线，清空将使用您当前默认路线。</small></span></label>
        <div class="form-row stream-row"><span>非流输出</span><div class="advanced-control"><div><span class="switch"><input v-model="form.un_stream" type="checkbox" role="switch"><i></i></span><small>启用后该Ai将会一次性输出结果。(等待时间较长-不建议)</small></div><small>某些对话模型如果不支持流式输出，可开启该功能。</small></div></div>
      </section>

      <footer><button type="button" @click="dialog.close()">取消</button><button class="primary" type="submit">保存</button></footer>
    </form>
  </dialog>
</template>

<style scoped>
.agent-dialog { width: 560px; max-width: calc(100vw - 24px); max-height: calc(100dvh - 20px); margin: auto; padding: 24px 32px 32px; overflow: visible; border: 0; border-radius: 12px; color: var(--color-text-2); background: var(--color-bg-3); line-height: 22px; transform: translateY(15px); }
.agent-dialog::backdrop { background: rgba(29, 33, 41, .6); }
.agent-dialog.function-dialog { transform: translateY(16.5px); }
.agent-dialog:focus { outline: 0; }
.agent-dialog form { position: relative; padding-top: 25px; }
.avatar-editor { position: absolute; z-index: 1; top: -60px; left: 50%; width: 78px; height: 78px; transform: translateX(-50%); }
.avatar-edit { position: absolute; right: 0; bottom: 0; width: 20px; height: 20px; display: grid; place-items: center; border: 2px solid var(--color-bg-3); border-radius: 50%; color: var(--color-text-3); background: var(--color-fill-1); }
.avatar-edit i { font-size: 11px; }
.dialog-tabs { height: 50px; padding: 0 16px; display: flex; align-items: flex-end; gap: 32px; border-bottom: 1px solid var(--color-border-2); }
.dialog-tabs button { position: relative; height: 40px; padding: 8px 0; color: var(--color-text-1); line-height: 22px; }
.dialog-tabs button:focus-visible { outline-offset: -2px; }
.dialog-tabs button.active { color: var(--color-primary); font-weight: 500; }
.dialog-tabs button.active::after { content: ""; position: absolute; right: 0; bottom: -1px; left: 0; height: 2px; background: var(--color-primary); }
.dialog-pane { width: 100%; padding-top: 16px; }
.form-row { min-height: 32px; margin-bottom: 20px; display: flex; align-items: flex-start; }
.form-row > span:first-child { width: 90px; flex: 0 0 90px; padding-top: 5px; }
.form-row.required > span:first-child::after { content: " *"; color: #f53f3f; }
.control, .form-row > input { position: relative; min-width: 0; flex: 1; }
.form-row > input, .control > input, .control > textarea, .control > select { width: 100%; border: 1px solid transparent; outline: 0; color: var(--color-text-2); background: var(--color-fill-2); }
.form-row > input, .control > input, .control > select { height: 32px; padding: 0 12px; border-radius: 12px; font: inherit; }
.control > textarea { height: 54px; min-height: 54px; padding: 4px 12px; border-radius: 12px; resize: none; line-height: 22px; }
.form-row > input:focus, .control > input:focus, .control > textarea:focus, .control > select:focus { border-color: var(--color-primary); background: var(--color-bg-2); }
.control small { display: block; color: var(--color-text-3); font-size: 12px; line-height: 19px; }
.control small b, .radios b, .advanced-control button { color: var(--color-primary); font-weight: 400; }
.select-control select { padding-right: 34px; appearance: none; }
.select-control > i, .input-control > i { position: absolute; top: 6px; right: 13px; color: var(--color-icon); font-size: 12px; pointer-events: none; }
.model-row { margin-bottom: 20px; }
.model-row .control { min-height: 55px; }
.type-row { margin-bottom: 20px; align-items: center; }
.type-row > span:first-child { padding-top: 0; }
.radios { display: flex; align-items: center; gap: 24px; }
.radios label { display: flex; align-items: center; gap: 7px; white-space: nowrap; }
.radios input { width: 14px; height: 14px; margin: 0; accent-color: var(--color-primary); }
.textarea-row { margin-bottom: 20px; }
.prefix-row { margin-bottom: 20px; }
.prefix-row .control small { line-height: 23px; }
.function-row { height: 54px; margin-bottom: 20px; }
.function-summary { margin-bottom: 8px; align-items: center; }
.function-summary > span:first-child { padding-top: 0; }
.summary-control { display: flex; flex: 1; align-items: center; gap: 8px; }
.summary-control small { color: var(--color-text-3); font-size: 12px; }
.outside-row, .outside-mode, .share-row { margin-bottom: 8px; align-items: center; }
.outside-row > span:first-child, .outside-mode > span:first-child, .share-row > span:first-child { padding-top: 0; }
.split-row { display: flex; flex: 1; align-items: center; justify-content: space-between; }
.switch-label { display: flex; align-items: center; gap: 8px; }
.switch-label > span:first-child:not(.switch) { margin-left: auto; }
.switch-label small { width: 12px; height: 12px; display: grid; place-items: center; border: 1px solid var(--color-border-2); border-radius: 50%; color: var(--color-text-3); font-size: 9px; }
.switch { position: relative; width: 28px; height: 16px; display: inline-block; flex: 0 0 28px; vertical-align: middle; }
.switch input { position: absolute; opacity: 0; }
.switch i { position: absolute; inset: 0; border-radius: 8px; background: #c9cdd4; }
.switch i::after { content: ""; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; transition: transform .2s ease; }
.switch input:checked + i { background: var(--color-primary); }
.switch input:checked + i::after { transform: translateX(12px); }
.status-radios { gap: 20px; }
.basic-pane { min-height: 656px; transform: translateY(-.765625px); }
.basic-pane.function-pane { min-height: 670px; }
.params-pane { min-height: 302px; padding: 16px 12px 0; }
.parameter-row { height: 44px; display: flex; align-items: center; }
.parameter-row > span { width: 90px; flex: 0 0 90px; color: var(--color-text-1); }
.parameter-row > span small { width: 12px; height: 12px; display: inline-grid; place-items: center; border: 1px solid var(--color-border-2); border-radius: 50%; color: var(--color-text-3); font-size: 9px; line-height: 10px; }
.parameter-row input[type="range"] { min-width: 0; height: 18px; margin: 0 20px 0 0; flex: 1; appearance: none; background: transparent; }
.parameter-row input[type="range"]::-webkit-slider-runnable-track { height: 2px; background: linear-gradient(to right, var(--color-primary) 0 var(--range-progress), var(--color-border-2) var(--range-progress) 100%); }
.parameter-row input[type="range"]::-webkit-slider-thumb { width: 12px; height: 12px; margin-top: -5px; appearance: none; border: 2px solid var(--color-primary); border-radius: 50%; background: var(--color-bg-2); }
.parameter-number { width: 80px; height: 32px; padding: 0 12px; border: 0; border-radius: 3px; outline: 0; background: var(--color-fill-2); text-align: center; }
.parameter-number::-webkit-inner-spin-button, .parameter-number::-webkit-outer-spin-button { appearance: none; }
.params-pane p { margin-left: 90px; color: var(--color-text-3); font-size: 12px; }
.advanced-pane { min-height: 252px; padding: 16px 12px 0; }
.advanced-pane .form-row { margin-bottom: 12px; }
.advanced-pane .form-row > span:first-child { width: 90px; flex-basis: 90px; }
.tag-input { min-height: 32px; padding: 0 12px; display: flex; align-items: center; gap: 4px; overflow: hidden; border-radius: 12px; background: var(--color-fill-2); }
.tag-input input { min-width: 100px; padding: 0; flex: 1; background: transparent; }
.question-tag { padding: 0 6px; border-radius: 3px; background: var(--color-primary-light-1); white-space: nowrap; }
.question-tag button { margin-left: 4px; }
.advanced-control { min-width: 0; flex: 1; }
.advanced-control > div { height: 24px; display: flex; align-items: center; gap: 10px; }
.advanced-control > small { display: block; color: var(--color-text-3); font-size: 12px; line-height: 19px; }
.advanced-control div > small { color: var(--color-text-3); font-size: 12px; }
.api-row { margin-bottom: 10px !important; }
.api-row .control { min-height: 52px; }
.stream-row { margin-bottom: 0 !important; }
.agent-dialog footer { height: 32px; margin-top: 20px; display: flex; align-items: center; justify-content: center; gap: 12px; }
.agent-dialog footer button { height: 32px; padding: 0 15px; border: 1px solid transparent; border-radius: 12px; background: var(--color-fill-2); }
.agent-dialog footer .primary { color: #fff; background: var(--color-primary); }
@media (max-height: 860px) {
  .agent-dialog { overflow-y: auto; }
  .avatar-editor { top: -50px; }
}
</style>
