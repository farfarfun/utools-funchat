<script setup>
import { computed, reactive, ref } from 'vue';
import { saveAgent } from '../../services/storage.js';
import { useChatStore } from '../../stores/chat.js';

const store = useChatStore();
const preferences = reactive({
  windowHeight: Number(store.state.settings.windowHeight) || 660,
  autoSort: store.state.settings.autoSort ?? true,
  storage: { bucket: '', accessKeyId: '', accessKeySecret: '', endpoint: '', domain: '', ...store.state.settings.storage },
  audio: { autoTts: false, lang: 'zh', ...store.state.settings.audio },
});
const selectedAgents = ref([]);
const modelFilter = ref('');
const targetModel = ref('');
const sourceAgents = computed(() => store.state.agents.filter((agent) => {
  if (selectedAgents.value.includes(agent._id)) return false;
  return !modelFilter.value || (agent.params?.model || '').toLocaleLowerCase().includes(modelFilter.value.toLocaleLowerCase());
}));
const targetAgents = computed(() => store.state.agents.filter((agent) => selectedAgents.value.includes(agent._id)));
const modelOptions = computed(() => [...new Set(store.state.agents.map((agent) => agent.params?.model).filter(Boolean))]);

function savePreferences() {
  store.updateSettings({ ...store.state.settings, ...preferences });
}

function replaceModels() {
  const model = targetModel.value.trim();
  if (!model || !selectedAgents.value.length) return;
  for (const agent of targetAgents.value) {
    agent.params.model = model;
    saveAgent(agent);
  }
  selectedAgents.value = [];
  targetModel.value = '';
}
</script>

<template>
  <main class="reference-settings">
    <section class="reference-card preference-card">
      <div class="setting-row height-row">
        <div class="reference-label">插件高度</div>
        <div class="reference-body">
          <div class="height-control">
            <input v-model.number="preferences.windowHeight" type="range" min="450" max="1000" @change="savePreferences">
            <input v-model.number="preferences.windowHeight" class="height-number" type="number" min="450" max="1000" @change="savePreferences">
          </div>
          <small>仅在“插件未分离”和“自动分离后宽度最小”的时候生效（为了兼容分离插件后拖动窗口的记忆功能）</small>
        </div>
      </div>
      <div class="setting-row sort-row">
        <div class="reference-label">自动排序</div>
        <div class="reference-body inline-body">
          <label class="switch"><input v-model="preferences.autoSort" type="checkbox" role="switch" @change="savePreferences"><span></span></label>
          <small>AI列表是否自动排序，默认-开启，关闭后可通过拖拽调整好友顺序，但失去虚拟列表优化。</small>
        </div>
      </div>
    </section>

    <section class="reference-card model-card">
      <div class="reference-label">模型更新</div>
      <div class="reference-body model-body">
        <div class="model-transfer">
          <div class="transfer-view source-view">
            <header><b>待选好友</b><span>{{ sourceAgents.length }}</span></header>
            <label class="model-search"><i class="iconfont icon-search" aria-hidden="true"></i><input v-model="modelFilter" list="model-options" placeholder="搜索模型"><i class="iconfont icon-down select-arrow" aria-hidden="true"></i></label>
            <div class="transfer-list">
              <button v-for="agent in sourceAgents" :key="agent._id" type="button" @click="selectedAgents.push(agent._id)">{{ agent.nickname }}</button>
            </div>
          </div>
          <div class="transfer-view target-view">
            <header><b>目标好友</b><span>{{ targetAgents.length }}</span><button type="button" title="清空" aria-label="清空" @click="selectedAgents = []"><i class="iconfont icon-delete"></i></button></header>
            <label class="target-model"><input v-model="targetModel" list="model-options" placeholder="选择目标模型"><i class="iconfont icon-down select-arrow" aria-hidden="true"></i></label>
            <div v-if="targetAgents.length" class="transfer-list">
              <button v-for="agent in targetAgents" :key="agent._id" type="button" @click="selectedAgents = selectedAgents.filter((id) => id !== agent._id)">{{ agent.nickname }}</button>
            </div>
            <div v-else class="transfer-empty">
              <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M9 25h30l5 10v8H4v-8zM15 35l3 4h12l3-4M24 4v10M8 10l7 7M40 10l-7 7" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>
              <span>暂无数据</span>
            </div>
          </div>
        </div>
        <datalist id="model-options"><option v-for="model in modelOptions" :key="model" :value="model"></option></datalist>
        <button class="replace-button" type="button" @click="replaceModels"><i class="iconfont icon-refresh" aria-hidden="true"></i>一键批量替换模型</button>
        <div class="instructions"><p>使用说明：</p><p>1、在左侧点击需要替换的好友到右侧。</p><p>2、在右侧选择目标模型。</p><p>3、点击“一键替换”按钮进行批量替换模型。</p></div>
      </div>
    </section>

    <section class="reference-card storage-card">
      <div class="reference-label">文件存储</div>
      <div class="reference-body storage-body">
        <p class="notice">插件文件存储支持兼容 S3 API 的对象存储服务，可配置存储桶、访问密钥、服务器端点和绑定域名。</p>
        <input v-model="preferences.storage.bucket" placeholder="Bucket 存储桶名称">
        <input v-model="preferences.storage.accessKeyId" placeholder="AccessKeyId 访问密钥 ID">
        <input v-model="preferences.storage.accessKeySecret" type="password" placeholder="AccessKeySecret 访问密钥">
        <input v-model="preferences.storage.endpoint" placeholder="S3服务器端点，https://...">
        <input v-model="preferences.storage.domain" placeholder="（可选）绑定域名">
        <button type="button" @click="savePreferences">保存存储设置</button>
      </div>
    </section>

    <section class="reference-card audio-card">
      <div class="reference-label">语音对话</div>
      <div class="reference-body audio-body">
        <div class="inline-body"><label class="switch"><input v-model="preferences.audio.autoTts" type="checkbox" role="switch" @change="savePreferences"><span></span></label><small>语音消息发送后，是否自动播报Ai回复的消息。</small></div>
        <input v-model="preferences.audio.lang" placeholder="请选择首选语言" @change="savePreferences">
        <small>首选国家语言，可以手动输入，请参考 ISO 639-1 代码表。</small>
      </div>
    </section>
  </main>
</template>

<style scoped>
.switch { position: relative; width: 40px; height: 24px; display: inline-block; flex: 0 0 40px; cursor: pointer; }
.switch > span { position: absolute; inset: 0; border-radius: 12px; background: var(--color-fill-3); }
.switch > span::after { content: ""; position: absolute; top: 4px; left: 4px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: left .2s ease; }
.switch input:checked + span { background: var(--color-primary); }
.switch input:checked + span::after { left: 20px; }

.reference-settings { min-width: 0; height: 100%; padding: 20px; flex: 1; overflow-y: auto; background: transparent; line-height: 1.8; }
.reference-settings { scrollbar-width: none; }
.reference-settings::-webkit-scrollbar { width: 0; height: 0; }
.reference-card { width: 100%; margin-bottom: 12px; padding: 32px; display: flex; border-radius: 12px; background: var(--color-bg-3); }
.reference-label { width: 120px; flex: 0 0 120px; color: var(--color-text-2); }
.reference-body { min-width: 0; flex: 1; }
.preference-card { height: 159px; flex-direction: column; }
.setting-row { display: flex; }
.height-row { height: 58px; margin-bottom: 12px; }
.sort-row { height: 25px; }
.height-control { height: 32px; display: flex; align-items: center; gap: 20px; }
.height-control input[type="range"] { height: 18px; min-width: 200px; flex: 1; appearance: none; background: transparent; }
.height-control input[type="range"]::-webkit-slider-runnable-track { height: 2px; border-radius: 1px; background: linear-gradient(to right, var(--color-primary) 0 38%, var(--color-border-2) 38% 100%); }
.height-control input[type="range"]::-webkit-slider-thumb { width: 12px; height: 12px; margin-top: -5px; appearance: none; border: 2px solid var(--color-primary); border-radius: 50%; background: var(--color-bg-2); }
.height-number { width: 80px; height: 32px; padding: 0 12px; border: 0; border-radius: 3px; outline: 0; color: var(--color-text-2); background: var(--color-fill-2); font-weight: 400; text-align: center; }
.height-number::-webkit-inner-spin-button, .height-number::-webkit-outer-spin-button { appearance: none; margin: 0; }
.reference-body small { color: var(--color-text-3); font-size: 12px; }
.inline-body { display: flex; align-items: center; }
.inline-body small { margin-left: 8px; }
.model-card { height: 571px; }
.model-body { height: 507px; }
.model-transfer { width: 520px; height: 350px; display: flex; }
.reference-settings .transfer-view { width: 260px; height: 350px; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--color-border-2); border-radius: 4px 0 0 4px; }
.reference-settings .transfer-view + .transfer-view { border-left: 0; border-radius: 0 4px 4px 0; }
.reference-settings .transfer-view header { height: 42px; padding: 0 10px; display: flex; flex: 0 0 42px; align-items: center; background: var(--color-fill-1); }
.reference-settings .transfer-view header b { flex: 1; font-size: 14px; font-weight: 500; }
.reference-settings .transfer-view header span { margin-right: 8px; color: var(--color-text-3); font-size: 12px; }
.reference-settings .transfer-view header button { width: 20px; height: 28px; color: var(--color-icon); }
.reference-settings .source-view header span { margin-right: 2px; }
.reference-settings .target-view header b { flex: 0 0 136px; }
.reference-settings .target-view header button { margin-left: auto; }
.model-search, .target-model { position: relative; height: 50px; padding: 0 10px 14px; display: flex; flex: 0 0 50px; align-items: flex-start; background: var(--color-fill-1); }
.model-search { position: relative; }
.model-search i { position: absolute; left: 24px; color: var(--color-icon); font-size: 14px; }
.model-search .select-arrow, .target-model .select-arrow { left: auto; }
.model-search input, .target-model input { width: 100%; height: 36px; padding: 0 12px; border: 1px solid var(--color-border-2); border-radius: 12px; outline: 0; background: var(--color-bg-3); }
.model-search input { padding-left: 38px; }
.model-search input, .target-model input { padding-right: 34px; }
.select-arrow { position: absolute; top: 10px; right: 23px; color: var(--color-icon); font-size: 12px; pointer-events: none; }
.model-search input:focus, .target-model input:focus { border-color: var(--color-primary); }
.reference-settings .transfer-list { flex: 1; overflow-y: auto; }
.reference-settings .transfer-list { scrollbar-width: none; }
.reference-settings .transfer-list::-webkit-scrollbar { width: 0; height: 0; }
.reference-settings .transfer-list button { width: 100%; height: 36px; padding: 0 10px; color: var(--color-text-2); line-height: 36px; text-align: left; }
.reference-settings .transfer-list button:hover { color: var(--color-text-1); background: var(--color-fill-2); }
.transfer-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--color-text-3); }
.transfer-empty svg { width: 48px; height: 48px; color: #a9aeb8; }
.transfer-empty span { margin-top: 4px; }
.replace-button { width: 530px; height: 32px; margin-top: 12px; border-radius: 12px; color: #fff; background: var(--color-primary); }
.replace-button i { margin-right: 8px; color: #fff; }
.reference-settings .instructions { height: 101px; margin-top: 12px; color: var(--color-text-3); }
.reference-settings .instructions p { height: 25px; margin: 0; }
.storage-card { min-height: 470px; }
.storage-body .notice { min-height: 51px; margin: 0 0 20px; padding: 12px; border: 1px solid rgba(52, 211, 153, .3); border-radius: 12px; color: #047857; background: rgba(52, 211, 153, .08); font-size: 13px; }
.storage-body > input, .audio-body > input { width: 100%; height: 36px; margin-bottom: 12px; padding: 0 12px; border: 1px solid transparent; border-radius: 12px; outline: 0; background: var(--color-fill-2); }
.storage-body > input:focus, .audio-body > input:focus { border-color: var(--color-primary); background: var(--color-bg-2); }
.storage-body > button { height: 32px; margin-top: 8px; padding: 0 15px; border-radius: 12px; color: #fff; background: var(--color-primary); }
.audio-card { min-height: 216px; }
.audio-body > input { margin-top: 16px; }
@media (max-width: 720px) {
  .reference-settings { padding: 12px; }
  .reference-card { min-width: 650px; padding: 24px; }
}
</style>
