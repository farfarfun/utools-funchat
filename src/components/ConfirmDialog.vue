<script setup>
import { reactive, ref } from 'vue';

const dialog = ref();
const content = reactive({ title: '', message: '', confirmText: '确定' });
let resolveOpen;
let confirmed = false;

function open(options) {
  if (dialog.value.open) return Promise.resolve(false);
  Object.assign(content, { confirmText: '确定', ...options });
  confirmed = false;
  dialog.value.showModal();
  dialog.value.focus();
  return new Promise((resolve) => { resolveOpen = resolve; });
}

function confirm() {
  confirmed = true;
  dialog.value.close();
}

function closed() {
  resolveOpen?.(confirmed);
  resolveOpen = null;
}

defineExpose({ open });
</script>

<template>
  <dialog ref="dialog" class="confirm-dialog" tabindex="-1" @close="closed">
    <h2>{{ content.title }}</h2>
    <p>{{ content.message }}</p>
    <footer><button type="button" @click="dialog.close()">取消</button><button class="primary" type="button" @click="confirm">{{ content.confirmText }}</button></footer>
  </dialog>
</template>

<style scoped>
.confirm-dialog { width: min(400px, calc(100vw - 32px)); margin: auto; padding: 24px 32px 32px; border: 0; border-radius: 12px; color: var(--color-text-2); background: var(--color-bg-3); text-align: center; }
.confirm-dialog::backdrop { background: rgba(29, 33, 41, .6); }
.confirm-dialog:focus { outline: 0; }
.confirm-dialog h2 { height: 28px; color: var(--color-text-1); font-size: 16px; font-weight: 500; line-height: 25px; }
.confirm-dialog p { min-height: 22px; margin-top: 24px; line-height: 22px; }
.confirm-dialog footer { height: 32px; margin-top: 32px; display: flex; justify-content: center; gap: 12px; }
.confirm-dialog button { height: 32px; padding: 0 15px; border: 1px solid transparent; border-radius: 12px; background: var(--color-fill-2); }
.confirm-dialog .primary { color: #fff; background: var(--color-primary); }
</style>
