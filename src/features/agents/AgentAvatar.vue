<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  agent: { type: Object, required: true },
  size: { type: Number, default: 36 },
});

const imageUrl = computed(() => props.agent.avatar?.type === 'image' && props.agent.avatar.image
  ? `./avatars/${props.agent.avatar.image}.jpg`
  : '');
const iconSize = computed(() => props.size === 26 ? 16 : props.size / 2 + 4);
const iconName = computed(() => props.agent.avatar?.icon || 'icon-a1');
const background = computed(() => props.agent.avatar?.color || '#0ca47f');
const failed = ref(false);
</script>

<template>
  <span class="agent-avatar" :style="{ width: `${size}px`, height: `${size}px`, background, '--avatar-icon-size': `${iconSize}px` }">
    <img v-if="imageUrl && !failed" :src="imageUrl" :alt="agent.nickname" @error="failed = true">
    <i v-else class="icon" :class="iconName" aria-hidden="true"></i>
    <span v-if="!imageUrl && !iconName">{{ agent.nickname?.slice(0, 1) }}</span>
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
</style>
