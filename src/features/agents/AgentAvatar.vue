<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  agent: { type: Object, required: true },
  size: { type: Number, default: 36 },
});

const avatar = computed(() => props.agent.avatar || {});

const imageUrl = computed(() => avatar.value.type === 'image' && avatar.value.image
  ? `./avatars/${avatar.value.image}.jpg`
  : '');
const isEmoji = computed(() => avatar.value.type === 'emoji' && Boolean(avatar.value.emoji));
const iconSize = computed(() => props.size === 26 ? 16 : props.size / 2 + 4);
// emoji 字形本身自带留白，比线性图标要略大才视觉等重
const emojiSize = computed(() => Math.round(props.size * 0.56));
const iconName = computed(() => avatar.value.icon || 'icon-a1');

// gradient 为两色数组时走渐变，否则退回单色 color，两者都缺则用默认绿
const background = computed(() => {
  const gradient = avatar.value.gradient;
  if (Array.isArray(gradient) && gradient.length >= 2) {
    return `linear-gradient(135deg, ${gradient[0]} 0%, ${gradient[1]} 100%)`;
  }
  return avatar.value.color || '#0ca47f';
});

const failed = ref(false);
</script>

<template>
  <span
    class="agent-avatar"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      background,
      '--avatar-icon-size': `${iconSize}px`,
      '--avatar-emoji-size': `${emojiSize}px`,
    }"
  >
    <img v-if="imageUrl && !failed" :src="imageUrl" :alt="agent.nickname" @error="failed = true">
    <span v-else-if="isEmoji" class="emoji" role="img" :aria-label="agent.nickname">{{ avatar.emoji }}</span>
    <i v-else class="icon" :class="iconName" aria-hidden="true"></i>
  </span>
</template>

<style scoped>
.agent-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  overflow: hidden;
  border-radius: 50%;
  color: #fff;
}
.agent-avatar img { width: 100%; height: 100%; object-fit: cover; }
.agent-avatar .icon { font-size: var(--avatar-icon-size); font-weight: 500; line-height: 1; }
.agent-avatar .emoji {
  font-size: var(--avatar-emoji-size);
  line-height: 1;
  /* 彩色 emoji 字体优先，避免部分 Linux 环境回退成单色轮廓 */
  font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;
  user-select: none;
}
</style>
