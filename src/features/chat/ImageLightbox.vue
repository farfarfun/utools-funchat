<script setup lang="ts">
import { ref, watch } from 'vue';
import { closePreview, previewUrl } from './image-preview.js';

const dialog = ref();

// 用原生 dialog：Esc 关闭、焦点收拢、置顶遮罩都是白送的，和 ConfirmDialog 保持一致
watch(previewUrl, (url) => {
  if (url && !dialog.value?.open) dialog.value?.showModal();
  else if (!url && dialog.value?.open) dialog.value?.close();
});
</script>

<template>
  <dialog ref="dialog" class="image-lightbox" aria-label="图片预览" @close="closePreview" @click="closePreview">
    <img v-if="previewUrl" :src="previewUrl" alt="图片预览">
  </dialog>
</template>

<style scoped>
.image-lightbox { max-width: 92vw; max-height: 92vh; padding: 0; overflow: hidden; border: 0; border-radius: 8px; background: transparent; }
.image-lightbox::backdrop { background: #000000b8; }
.image-lightbox img { max-width: 92vw; max-height: 92vh; display: block; object-fit: contain; cursor: zoom-out; }
</style>
