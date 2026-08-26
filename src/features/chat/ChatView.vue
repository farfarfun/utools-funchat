<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue';
import AgentAvatar from '../agents/AgentAvatar.vue';
import { useChatStore } from '../../stores/chat.js';
import ChatComposer from './ChatComposer.vue';
import ChatExportMenu from './ChatExportMenu.vue';
import HistoryPanel from './HistoryPanel.vue';
import MessageItem from './MessageItem.vue';

const store = useChatStore();
const scroll = ref();
const greeting = computed(() => ({ role: 'assistant', content: store.state.currentAgent?.content || '' }));
const needsApiSetup = computed(() => store.state.settings.provider !== 'utools' && !store.state.settings.apiKey && !store.state.settings.baseUrl);
const quickQuestions = computed(() => (store.state.messages.length ? [] : store.state.currentAgent?.quick_questions || []));
const apiSetup = reactive({ apiKey: store.state.settings.apiKey || '', baseUrl: store.state.settings.baseUrl || '' });

const messageKeys = new WeakMap();
let messageKeySeed = 0;

function messageKey(message, index) {
  if (!message || typeof message !== 'object') return `${store.state.currentAgent?._id}-${index}`;
  if (!messageKeys.has(message)) messageKeys.set(message, `message-${++messageKeySeed}`);
  return messageKeys.get(message);
}

function saveApiSetup() {
  if (!apiSetup.apiKey.trim() && !apiSetup.baseUrl.trim()) return;
  // 走线路系统，否则这里存的配置在「API路线管理」里看不见
  store.saveApiRoute({
    id: '',
    name: '默认线路',
    provider: 'openai',
    apiKey: apiSetup.apiKey.trim(),
    baseUrl: apiSetup.baseUrl.trim(),
    streamMode: 'client',
  });
}

watch(() => store.state.messages.at(-1)?.content, async () => {
  await nextTick();
  if (scroll.value) scroll.value.scrollTop = scroll.value.scrollHeight;
});

watch(() => [store.state.currentAgent?._id, store.state.currentAgent?.chatId], async () => {
  await nextTick();
  if (scroll.value) scroll.value.scrollTop = 0;
});

</script>

<template>
  <main class="chat-view">
    <ChatExportMenu />
    <section ref="scroll" class="messages" aria-live="polite">
      <div class="messages-content">
        <div v-if="needsApiSetup" class="api-setup-wrap">
          <form class="api-setup-card" @submit.prevent="saveApiSetup">
            <AgentAvatar class="setup-avatar" :agent="store.state.currentAgent" :size="60" />
            <h1>只差一步，<button type="button" @click="store.state.view = 'help'">点击查看解锁绑定API教程</button></h1>
            <label class="setup-field required"><span>API KEY秘钥</span><input v-model="apiSetup.apiKey" type="password" autocomplete="off" placeholder="请复制或输入KEY秘钥（令牌）"></label>
            <label class="setup-field"><span>API地址（转发API必填，官方KEY请忽略）</span><input v-model="apiSetup.baseUrl" placeholder="示例: https://api.gpt.ge"></label>
            <button class="setup-save" type="submit">保存并开始</button>
          </form>
          <div class="setup-tips"><p>1、API管理：可点击聊天窗口 <i class="iconfont icon-key" aria-hidden="true"></i> API管理按钮，进行管理-支持无限添加API。</p><p>2、免费体验：可使用客户端内置 AI，或绑定自己的API使用。</p></div>
        </div>
        <template v-else>
          <MessageItem v-if="greeting.content" :message="greeting" :agent="store.state.currentAgent" />
          <div v-if="quickQuestions.length" class="quick-questions">
            <button v-for="item in quickQuestions" :key="item" type="button" :disabled="store.state.loading" @click="store.send(item)">{{ item }}</button>
          </div>
          <MessageItem v-for="(message, index) in store.state.messages" :key="messageKey(message, index)"
            :message="message" :index="index" :agent="store.state.currentAgent" :last="index === store.state.messages.length - 1"
            :busy="store.state.loading" @delete="store.deleteMessage" @retry="store.retryMessage" />
          <div v-if="store.state.loading" class="typing" role="status"><span></span><span></span><span></span></div>
        </template>
      </div>
    </section>
    <ChatComposer />
    <Transition name="history-drawer"><HistoryPanel v-if="store.state.historyOpen" /></Transition>
  </main>
</template>

<style scoped>
.chat-view { position: relative; min-width: 0; height: 100vh; display: flex; flex: 1; flex-direction: column; background: var(--chat-bg); }
.messages { flex: 1; overflow-y: auto; scrollbar-width: none; scroll-behavior: smooth; will-change: transform; }
.messages::-webkit-scrollbar { width: 0; }
.messages-content { min-height: 100%; padding-top: 20px; }
.api-setup-wrap { margin: 40px 52px 0; }
.api-setup-card { position: relative; height: 337px; padding: 110px 32px 32px; border-radius: 12px; background: var(--color-bg-5); }
.setup-avatar { position: absolute; top: -26px; left: calc(50% - 30px); }
.api-setup-card h1 { position: absolute; top: 53px; right: 0; left: 0; color: var(--color-text-2); font-size: 20px; font-weight: 700; line-height: 23px; text-align: center; }
.api-setup-card h1 button { margin-right: 8px; color: #3b82f6; font-weight: inherit; text-decoration: underline; }
.setup-field { display: block; margin-right: 1px; margin-bottom: 20px; margin-left: 1px; color: var(--color-text-2); line-height: 22px; }
.setup-field:first-of-type { margin-bottom: 22px; }
.setup-field.required > span::before { content: "*"; margin-right: 4px; color: #f53f3f; }
.setup-field input { width: 100%; height: 32px; margin-top: 6px; padding: 0 13px; border: 1px solid transparent; border-radius: 12px; outline: 0; background: var(--color-fill-2); }
.setup-field input:focus { border-color: var(--color-primary); background: var(--color-bg-2); }
.setup-save { width: calc(100% - 2px); height: 32px; margin-left: 1px; border-radius: 12px; color: #fff; background: var(--color-primary); line-height: 22px; }
.setup-tips { margin-top: 12px; color: var(--color-text-3); font-size: 12px; line-height: 19.2px; }
.setup-tips i { display: inline; color: var(--color-primary); font-size: 14px; }
.quick-questions { margin: -18px 20px 30px 66px; display: flex; flex-wrap: wrap; gap: 8px; }
.quick-questions button { height: 30px; padding: 0 14px; border: 1px solid var(--color-border-2); border-radius: 15px; color: var(--color-text-2); background: var(--color-bg-2); font-size: 13px; }
.quick-questions button:hover:not(:disabled) { color: var(--color-primary); border-color: var(--color-primary); }
.quick-questions button:disabled { opacity: .5; }
.typing { width: 62px; height: 34px; margin: -18px 0 18px 66px; display: flex; align-items: center; justify-content: center; gap: 4px; border-radius: 3px 14px 14px; background: var(--color-bg-3); }
.typing span { width: 5px; height: 5px; border-radius: 50%; background: var(--color-text-3); animation: typing 1.2s infinite; }
.typing span:nth-child(2) { animation-delay: .15s; }
.typing span:nth-child(3) { animation-delay: .3s; }
@keyframes typing { 0%, 60%, 100% { transform: translateY(0); opacity: .45; } 30% { transform: translateY(-3px); opacity: 1; } }
</style>
