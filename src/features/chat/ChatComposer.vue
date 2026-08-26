<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useChatStore } from '../../stores/chat.js';
import ChatPopover from './ChatPopover.vue';
import { estimateTokens } from './token-count.js';

const store = useChatStore();
const text = ref('');
const textarea = ref();
const root = ref();
const popup = ref('');
const needsApiSetup = computed(() => store.state.settings.provider !== 'utools' && !store.state.settings.apiKey && !store.state.settings.baseUrl);
const displayedTokens = computed(() => needsApiSetup.value ? 0 : store.tokenCount.value + estimateTokens(text.value));

async function submit() {
  const value = text.value;
  if (!value.trim() || store.state.loading || !store.state.currentAgent) return;
  text.value = '';
  if (!await store.send(value)) text.value = value;
}

function keydown(event) {
  const ctrlMode = (store.state.settings.sendMode || 'ctrl-enter') === 'ctrl-enter';
  if (event.key === 'Enter' && !event.shiftKey && (ctrlMode ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey)) {
    event.preventDefault();
    submit();
  }
}

function togglePopup(value) {
  popup.value = popup.value === value ? '' : value;
}

function updateSetting(key, value) {
  store.updateSettings({ ...store.state.settings, [key]: value });
  popup.value = '';
}

function closeFromOutside(event) {
  if (!root.value?.contains(event.target)) popup.value = '';
}

onMounted(() => document.addEventListener('pointerdown', closeFromOutside));
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeFromOutside));
</script>

<template>
  <footer ref="root" class="chat-composer">
    <ChatPopover v-if="popup === 'api' || popup === 'params'" :kind="popup" @close="popup = ''" />
    <div class="composer-tools">
      <div class="tool-group">
        <button v-if="store.state.loading" type="button" title="停止生成" aria-label="停止生成" @click="store.stop">
          <i class="iconfont icon-close" aria-hidden="true"></i>
        </button>
        <button v-else type="button" title="语音输入暂未接入" aria-label="语音输入暂未接入" disabled>
          <span class="voice-rec-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48"><g fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="3.2"><rect width="16" height="27" x="16" y="4" rx="7"></rect><path stroke-linecap="round" d="M9 23c0 8.284 6.716 15 15 15s15-6.716 15-15M24 38v6"></path></g></svg>
          </span>
        </button>
        <button type="button" title="语音播报暂未接入" aria-label="语音播报暂未接入" disabled><i class="iconfont icon-volume-off" aria-hidden="true"></i></button>
        <button type="button" title="话题记录" aria-label="话题记录" @click="store.state.historyOpen = true"><i class="iconfont icon-huati" aria-hidden="true"></i></button>
        <button type="button" title="新话题" aria-label="新话题" @click="store.newConversation"><i class="iconfont icon-clear" aria-hidden="true"></i></button>
      </div>
      <div class="tool-group tool-group-end">
        <button type="button" title="API 设置" aria-label="API 设置" :aria-expanded="popup === 'api'" @click="togglePopup('api')"><i class="iconfont icon-key" aria-hidden="true"></i></button>
        <button type="button" title="模型参数" aria-label="模型参数" :aria-expanded="popup === 'params'" @click="togglePopup('params')"><i class="iconfont icon-params" aria-hidden="true"></i></button>
        <div class="popup-anchor">
          <button type="button" title="聊天风格" aria-label="聊天风格" :aria-expanded="popup === 'style'" @click="togglePopup('style')"><i class="iconfont icon-nuclear-outline" aria-hidden="true"></i></button>
          <div v-if="popup === 'style'" class="composer-menu style-menu" role="menu">
            <button :class="{ active: (store.state.settings.chatStyle || 'chat') === 'chat' }" type="button" role="menuitemradio" @click="updateSetting('chatStyle', 'chat')"><i class="iconfont icon-chat"></i>聊天风格</button>
            <button :class="{ active: store.state.settings.chatStyle === 'compact' }" type="button" role="menuitemradio" @click="updateSetting('chatStyle', 'compact')"><svg class="whirlwind-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true"><g stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"><circle cx="24" cy="24" r="5"></circle><path d="M23.5 44C16.6 44 11 38.4 11 31.5S16.6 19 23.5 19M44 23.5C44 30.4 38.4 36 31.5 36S19 30.4 19 23.5M23.5 29C30.4 29 36 23.4 36 16.5S30.4 4 23.5 4M29 23.5C29 16.6 23.4 11 16.5 11S4 16.6 4 23.5"></path></g></svg>紧凑风格</button>
            <button :class="{ active: store.state.settings.chatStyle === 'official' }" type="button" role="menuitemradio" @click="updateSetting('chatStyle', 'official')"><i class="iconfont icon-engine-atom-nuclear"></i>官网风格</button>
          </div>
        </div>
        <div class="popup-anchor more-anchor">
          <button class="more-button" type="button" title="更多设置" aria-label="更多设置" :aria-expanded="popup === 'more'" @click="togglePopup('more')"><span aria-hidden="true"><svg width="18" height="18" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="12" r="3" fill="var(--color-text-3)"></circle><circle cx="24" cy="24" r="3" fill="var(--color-text-3)"></circle><circle cx="24" cy="35" r="3" fill="var(--color-text-3)"></circle></svg></span></button>
          <div v-if="popup === 'more'" class="composer-menu more-menu" role="menu">
            <button type="button" role="menuitem" @click="store.state.view = 'help'; popup = ''">帮助中心</button>
            <button :class="{ active: store.state.settings.sendMode === 'enter' }" type="button" role="menuitemradio" @click="updateSetting('sendMode', 'enter')">Enter发送</button>
            <button :class="{ active: (store.state.settings.sendMode || 'ctrl-enter') === 'ctrl-enter' }" type="button" role="menuitemradio" @click="updateSetting('sendMode', 'ctrl-enter')">Ctrl+Enter发送</button>
          </div>
        </div>
      </div>
    </div>
    <div class="textarea-wrap" @click="textarea?.focus()"><textarea ref="textarea" v-model="text" placeholder="聊点什么吧..." spellcheck="false" @keydown="keydown"></textarea></div>
    <div class="composer-footer"><span class="token-count" :class="{ 'has-token': displayedTokens > 0 }">{{ displayedTokens.toLocaleString() }}</span></div>
  </footer>
</template>

<style scoped>
.chat-composer { position: relative; height: 160px; padding-top: 3px; display: flex; flex: 0 0 160px; flex-direction: column; overflow: visible; background: var(--color-bg-2); border-top: 1px solid var(--color-border-2); }
.composer-tools { height: 42px; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; }
.tool-group { display: flex; align-items: center; gap: 25px; }
.composer-tools button { position: relative; width: 28px; height: 28px; border-radius: 50%; color: var(--color-icon); }
.tool-group > :not(:last-child) { position: relative; }
.tool-group > :not(:last-child)::after { content: ""; position: absolute; top: 8px; right: -13px; width: 1px; height: 14px; background: var(--color-fill-2); pointer-events: none; }
.composer-tools button:hover { color: var(--color-primary); background: var(--color-fill-1); }
.composer-tools button:disabled { opacity: 1; color: var(--color-icon); }
.composer-tools .more-button { width: 18px; height: 18px; border-radius: 0; color: var(--color-text-3); }
.popup-anchor { position: relative; width: 28px; height: 28px; flex: 0 0 28px; }
.more-anchor { width: 18px; height: 18px; flex-basis: 18px; }
.composer-menu { position: absolute; z-index: 90; bottom: 32px; padding: 7px; display: flex; flex-direction: column; border-radius: 4px; color: var(--color-text-2); background: var(--color-bg-2); box-shadow: 0 4px 10px #0000001a; font-size: 14px; font-style: normal; font-weight: 400; line-height: 22px; white-space: nowrap; }
.composer-tools .composer-menu > button { width: 100%; height: 36px; padding: 0 8px; display: flex; align-items: center; gap: 8px; border-radius: 3px; color: var(--color-text-2); text-align: left; }
.composer-tools .composer-menu > button:hover, .composer-tools .composer-menu > button.active { color: var(--color-text-2); background: var(--color-primary-light-1); }
.composer-menu i { width: 16px; font-size: 16px !important; }
.whirlwind-icon { width: 16px; height: 16px; flex: 0 0 16px; }
.style-menu { right: -45px; width: 118px; }
.more-menu { right: -16px; bottom: 22px; width: 140px; }
.voice-rec-icon { position: relative; width: 100%; height: 100%; display: block; }
.voice-rec-icon svg { position: absolute; top: 50%; left: 50%; width: 18px; height: 18px; color: var(--color-icon); transform: translate(-50%, -50%); }
.tool-group:first-child button:nth-child(2) .iconfont, .tool-group:first-child button:nth-child(3) .iconfont, .tool-group-end button:nth-child(2) .iconfont { font-size: 18px; line-height: 28px; }
.composer-tools .iconfont, .composer-tools .icon { display: block; line-height: 1.5715; }
.tool-group-end { margin-left: auto; }
.textarea-wrap { height: 64px; flex: 0 0 64px; cursor: text; }
textarea { width: 100%; height: 50px; padding: 5px 16px 0; overflow-y: auto; border: 0; outline: 0; resize: none; color: var(--color-text-2); background: transparent; font-size: 15px; line-height: 1.5; }
textarea:focus, textarea:focus-visible { outline: 0; }
textarea::placeholder { color: #9ca3af; }
.composer-footer { height: 50px; padding: 0 16px 0 12px; display: flex; flex: 0 0 50px; align-items: center; overflow: hidden; }
.token-count { margin-left: auto; padding-top: 10px; color: #c9cdd4; font-size: 11px; font-variant-numeric: tabular-nums; line-height: 1.15; }
.token-count.has-token { color: var(--color-text-3); font-size: 12px; }
</style>
