<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { host } from '../../services/utools.js';
import AgentAvatar from '../agents/AgentAvatar.vue';
import { renderMarkdown } from './markdown.js';
import { isLongMessage, saveElementImage } from './message-tools.js';
import { messageText } from './token-count.js';

const props = defineProps({
  message: { type: Object, required: true },
  index: { type: Number, default: -1 },
  agent: { type: Object, required: true },
  last: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
});
const emit = defineEmits(['delete', 'retry']);
const root = ref();
const copied = ref(false);
const exporting = ref(false);
const long = computed(() => isLongMessage(messageText(props.message)));
const collapsed = ref(long.value);
const html = computed(() => renderMarkdown(messageText(props.message)));
const images = computed(() => Array.isArray(props.message.content)
  ? props.message.content.filter((part) => part.type === 'image_url').map((part) => part.image_url?.url).filter(Boolean)
  : []);

watch(long, (value) => { if (value) collapsed.value = true; });

function openLink(event) {
  const anchor = event.target.closest?.('a[href]');
  if (!anchor) return;
  event.preventDefault();
  const href = anchor.getAttribute('href');
  if (/^https?:\/\//iu.test(href)) host.shellOpenExternal(href);
}

async function copy() {
  await host.copyText(messageText(props.message));
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 1000);
}

async function exportImage() {
  exporting.value = true;
  const previous = collapsed.value;
  collapsed.value = false;
  await nextTick();
  try {
    await saveElementImage(root.value);
  } finally {
    collapsed.value = previous;
    exporting.value = false;
  }
}
</script>

<template>
  <article ref="root" class="chat-box-item" :class="[`chat-${message.role}`, { 'is-last': last, 'has-error': message.error }]">
    <AgentAvatar v-if="message.role === 'assistant'" :agent="agent" :size="26" />
    <span v-else class="user-avatar"><i class="iconfont icon-user" aria-hidden="true"></i></span>
    <div class="chat-content">
      <span class="nickname">{{ message.role === 'assistant' ? agent.nickname : '我' }}</span>
      <div v-if="images.length" class="message-images"><img v-for="image in images" :key="image" :src="image" alt="消息图片"></div>
      <div class="prose-chat" :class="{ collapsed }" v-html="html" @click="openLink"></div>
      <div v-if="index >= 0" class="message-actions">
        <button type="button" :title="copied ? '已复制' : '复制'" :aria-label="copied ? '已复制' : '复制'" @click="copy">
          <i class="iconfont" :class="copied ? 'icon-success' : 'icon-copy'" aria-hidden="true"></i>
        </button>
        <button type="button" title="保存此条消息为图片" aria-label="保存此条消息为图片" :disabled="exporting" @click="exportImage">
          <i class="iconfont icon-file" aria-hidden="true"></i>
        </button>
        <button v-if="long" type="button" :title="collapsed ? '展开此条消息' : '收起此条消息'"
          :aria-expanded="!collapsed" @click="collapsed = !collapsed">
          <i class="iconfont icon-down" :class="{ rotated: !collapsed }" aria-hidden="true"></i>
        </button>
        <button v-if="message.role === 'assistant'" type="button" title="重新生成" aria-label="重新生成" :disabled="busy" @click="emit('retry', index)">
          <i class="iconfont icon-refresh" aria-hidden="true"></i>
        </button>
        <button type="button" title="删除消息" aria-label="删除消息" :disabled="busy" @click="emit('delete', index)">
          <i class="iconfont icon-delete" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.chat-box-item { position: relative; display: flex; margin: 0 20px; padding: 0 0 30px; }
.chat-content { position: relative; min-width: 0; max-width: min(840px, calc(100% - 54px)); margin: 3px 12px 0; }
.nickname { display: block; margin-bottom: 6px; color: var(--color-text-3); font-size: 12px; line-height: 1.15; }
.prose-chat { margin-right: 28px; padding: 10px 16px; overflow: hidden; border-radius: 3px 16px 16px; color: var(--color-text-2); background: var(--color-bg-3); line-height: 1.8; overflow-wrap: anywhere; }
.prose-chat.collapsed { position: relative; max-height: 280px; }
.prose-chat.collapsed::after { content: ""; position: absolute; right: 0; bottom: 0; left: 0; height: 70px; background: linear-gradient(transparent, var(--color-bg-3)); pointer-events: none; }
.chat-user { justify-content: flex-end; }
.chat-user .chat-content { order: 1; }
.chat-user .user-avatar { order: 2; }
.chat-user .nickname { text-align: right; }
.chat-user .prose-chat { margin-right: 0; margin-left: 28px; border-radius: 16px 3px 16px 16px; background: var(--user-bubble); }
.chat-user .prose-chat.collapsed::after { background: linear-gradient(transparent, var(--user-bubble)); }
.user-avatar { width: 26px; height: 26px; display: grid; flex: 0 0 26px; place-items: center; border-radius: 50%; color: #fff; background: #0ca47f; }
.message-actions { position: absolute; bottom: -29px; left: 12px; display: flex; opacity: 0; transition: opacity .2s ease; }
.chat-user .message-actions { right: 12px; left: auto; }
.chat-box-item:hover .message-actions, .chat-box-item:focus-within .message-actions { opacity: 1; }
.message-actions button { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%; color: var(--color-icon); }
.message-actions button:hover { color: var(--color-primary); background: var(--color-bg-2); }
.message-actions button:disabled { opacity: .45; }
.rotated { transform: rotate(180deg); }
.has-error .prose-chat { border: 1px solid rgba(243, 94, 81, .35); color: #d94b40; }
.message-images { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 8px; }
.message-images img { max-width: 260px; max-height: 260px; border-radius: 6px; object-fit: contain; }
:deep(.prose-chat p + p), :deep(.prose-chat ul), :deep(.prose-chat ol), :deep(.prose-chat pre), :deep(.prose-chat blockquote) { margin-top: .8em; }
:deep(.prose-chat ul), :deep(.prose-chat ol) { padding-left: 1.4em; }
:deep(.prose-chat ul) { list-style: disc; }
:deep(.prose-chat ol) { list-style: decimal; }
:deep(.prose-chat a) { color: var(--color-primary); text-decoration: underline; }
:deep(.prose-chat pre) { padding: 12px 14px; overflow-x: auto; border-radius: 5px; color: #e8eaed; background: #282c34; line-height: 1.55; }
:deep(.prose-chat code:not(pre code)) { padding: 2px 5px; border-radius: 3px; color: #d84d73; background: var(--color-fill-2); }
:deep(.prose-chat blockquote) { padding-left: 12px; border-left: 3px solid var(--color-primary); color: var(--color-text-3); }
:deep(.prose-chat table) { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; }
:deep(.prose-chat th), :deep(.prose-chat td) { padding: 6px 10px; border: 1px solid var(--color-border-2); }
</style>
