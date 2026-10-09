<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { closePreview, previewUrl } from './image-preview.js';

const dialog = ref();

// 用原生 dialog：Esc 关闭、焦点收拢、置顶遮罩都是白送的，和 ConfirmDialog 保持一致
watch(previewUrl, (url) => {
  if (url && !dialog.value?.open) dialog.value?.showModal();
  else if (!url && dialog.value?.open) dialog.value?.close();
});

// 预览地址存在模块级，灯箱随 ChatView 卸载（切到设置页等）时必须一起清掉：
// 否则不仅留着一张 base64 大图，再点同一张图也打不开了——值没变，watch 不会触发。
onBeforeUnmount(closePreview);
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
