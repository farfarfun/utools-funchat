<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';

type PickerMode = 'single' | 'multiple';
type OpenOptions = { mode?: PickerMode; title?: string; hint?: string };

const dialog = ref<HTMLDialogElement>();
const all = ref<string[]>([]);
const checked = ref<string[]>([]);
const keyword = ref('');
const mode = ref<PickerMode>('multiple');
const title = ref('选择模型');
const hint = ref('');
let resolveOpen: ((value: string[] | null) => void) | null = null;
let confirmed = false;

// 列表可能有几百项，逐项 includes 会退化成 O(n²)，用 Set 做命中判断
const checkedSet = computed(() => new Set(checked.value));
const matches = computed(() => {
  const value = keyword.value.trim().toLowerCase();
  return value ? all.value.filter((model) => model.toLowerCase().includes(value)) : all.value;
});
const allMatchesChecked = computed(() => matches.value.length > 0 && matches.value.every((model) => checkedSet.value.has(model)));

/**
 * 打开模型选择弹窗。
 * @param models 可供选择的全部模型。
 * @param selected 需要预先选中的模型。
 * @param options `mode` 为 `single` 时点一下即选中并关闭；`multiple` 时勾选后点确定。
 * @returns 确定时返回选择结果，取消或重复打开时返回 `null`。
 */
function open(models: readonly string[], selected: readonly string[] = [], options: OpenOptions = {}): Promise<string[] | null> {
  if (!dialog.value || dialog.value.open) return Promise.resolve(null);
  mode.value = options.mode || 'multiple';
  title.value = options.title || (mode.value === 'single' ? '选择模型' : '选择要保留的模型');
  hint.value = options.hint || '';
  all.value = [...models];
  const keep = selected.filter((model) => models.includes(model));
  // 多选且没有任何既有选择时默认全选，省得用户面对几百个空框
  checked.value = keep.length || mode.value === 'single' ? keep : [...models];
  keyword.value = '';
  confirmed = false;
  dialog.value.showModal();
  return new Promise((resolve) => { resolveOpen = resolve; });
}

function choose(model: string) {
  if (mode.value === 'single') {
    checked.value = [model];
    confirm();
    return;
  }
  checked.value = checkedSet.value.has(model)
    ? checked.value.filter((item) => item !== model)
    : [...checked.value, model];
}

// 只对当前筛选结果生效：搜 "gpt" 再点全选，不该把列表外的模型一起带上
function toggleMatches() {
  if (allMatchesChecked.value) {
    const drop = new Set(matches.value);
    checked.value = checked.value.filter((model) => !drop.has(model));
    return;
  }
  checked.value = [...new Set([...checked.value, ...matches.value])];
}

function confirm() {
  confirmed = true;
  dialog.value?.close();
}

function closed() {
  // 按原始顺序回传，保证下拉里的顺序和拉取结果一致
  resolveOpen?.(confirmed ? all.value.filter((model) => checkedSet.value.has(model)) : null);
  resolveOpen = null;
}

// 宿主组件被卸载时 close 不会触发，调用方的 await 会永久挂起
onBeforeUnmount(() => {
  resolveOpen?.(null);
  resolveOpen = null;
});

defineExpose({ open });
</script>

<template>
  <dialog ref="dialog" class="model-picker" tabindex="-1" @close="closed">
    <header>
      <b>{{ title }}</b>
      <small>{{ hint || `共 ${all.length} 个可选模型` }}</small>
    </header>

    <div class="picker-tools">
      <label class="picker-search">
        <i class="iconfont icon-search" aria-hidden="true"></i>
        <input v-model="keyword" placeholder="搜索模型名称" spellcheck="false">
      </label>
      <button v-if="mode === 'multiple'" type="button" class="picker-toggle-all" :disabled="!matches.length" @click="toggleMatches">
        {{ allMatchesChecked ? '取消全选' : '全选' }}{{ keyword.trim() ? '（当前筛选）' : '' }}
      </button>
    </div>

    <div class="picker-list" :class="{ single: mode === 'single' }" role="listbox">
      <button
        v-for="model in matches"
        :key="model"
        type="button"
        class="picker-item"
        role="option"
        :aria-selected="checkedSet.has(model)"
        :class="{ on: checkedSet.has(model) }"
        @click="choose(model)"
      >
        <input v-if="mode === 'multiple'" type="checkbox" tabindex="-1" :checked="checkedSet.has(model)" @click.stop="choose(model)">
        <i v-else class="iconfont icon-success picker-tick" aria-hidden="true"></i>
        <span>{{ model }}</span>
      </button>
      <p v-if="!matches.length" class="picker-empty">
        <template v-if="all.length">没有匹配「{{ keyword }}」的模型</template>
        <template v-else>还没有可选模型，先到 API 线路管理里拉取一次</template>
      </p>
    </div>

    <footer>
      <span class="picker-count">
        <template v-if="mode === 'multiple'">已勾选 {{ checked.length }} / {{ all.length }}</template>
        <template v-else>点一下即选中</template>
      </span>
      <button type="button" @click="dialog?.close()">取消</button>
      <button v-if="mode === 'multiple'" class="picker-confirm" type="button" :disabled="!checked.length" @click="confirm">
        保留这 {{ checked.length }} 个
      </button>
    </footer>
  </dialog>
</template>

<style scoped>
.model-picker { width: 520px; max-width: 92vw; height: 70vh; max-height: 560px; padding: 0; overflow: hidden; border: 1px solid var(--color-border-2); border-radius: 12px; color: var(--color-text-2); background: var(--color-bg-2); box-shadow: 0 12px 32px #00000033; }
/* display 必须挂在 [open] 上：dialog 的隐藏靠 UA 样式的 dialog:not([open]){display:none}，
   而作者样式的层叠来源优先级高于 UA，无条件写 display 会让弹窗从一开始就留在页面流里 */
.model-picker[open] { display: flex; flex-direction: column; }
.model-picker::backdrop { background: #0000007a; }
.model-picker header { padding: 16px 20px 12px; display: flex; flex: 0 0 auto; flex-direction: column; gap: 3px; }
.model-picker header b { color: var(--color-text-1); font-size: 15px; font-weight: 600; }
.model-picker header small { color: var(--color-text-3); font-size: 12px; }
.picker-tools { padding: 0 20px 10px; display: flex; flex: 0 0 auto; align-items: center; gap: 8px; }
.picker-search { min-width: 0; height: 32px; padding: 0 12px; display: flex; flex: 1; align-items: center; gap: 8px; border: 1px solid transparent; border-radius: 10px; background: var(--color-fill-2); }
.picker-search:focus-within { border-color: var(--color-primary); background: var(--color-bg-2); }
.picker-search .iconfont { color: var(--color-icon); font-size: 14px; }
.picker-search input { min-width: 0; flex: 1; border: 0; outline: 0; color: inherit; background: transparent; }
.picker-toggle-all { height: 32px; padding: 0 12px; flex: 0 0 auto; border: 1px solid var(--color-border-2); border-radius: 10px; color: var(--color-text-2); font-size: 12px; white-space: nowrap; }
.picker-toggle-all:hover:not(:disabled) { color: var(--color-primary); border-color: var(--color-primary); }
.picker-toggle-all:disabled { opacity: .5; }
/* 列表是唯一可滚动的部分，头尾固定，几百个模型也不会把按钮顶出可视区 */
.picker-list { min-height: 0; padding: 0 12px 4px; display: flex; flex: 1; flex-direction: column; gap: 2px; overflow-y: auto; overscroll-behavior: contain; }
.picker-list::-webkit-scrollbar { width: 6px; }
.picker-list::-webkit-scrollbar-thumb { border-radius: 3px; background: var(--color-fill-3); }
.picker-item { min-height: 34px; padding: 0 8px; display: flex; flex: 0 0 auto; align-items: center; gap: 10px; border-radius: 8px; text-align: left; }
.picker-item:hover { background: var(--color-fill-1); }
.picker-item.on { color: var(--color-text-1); background: var(--color-primary-light-1); }
.picker-item input { width: 15px; height: 15px; flex: 0 0 15px; accent-color: var(--color-primary); pointer-events: none; }
/* 单选模式用对勾占位：选中才显示，但始终占位，避免选中瞬间文字左右跳动 */
.picker-tick { width: 15px; flex: 0 0 15px; color: var(--color-primary); font-size: 13px; visibility: hidden; }
.picker-item.on .picker-tick { visibility: visible; }
/* 模型 id 常有很长的同前缀串，等宽字体更容易比对，过长截断而不是换行 */
.picker-item span { min-width: 0; overflow: hidden; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; text-overflow: ellipsis; white-space: nowrap; }
.picker-empty { padding: 32px 8px; color: var(--color-text-3); font-size: 12px; line-height: 1.6; text-align: center; }
.model-picker footer { padding: 12px 20px 16px; display: flex; flex: 0 0 auto; align-items: center; gap: 8px; border-top: 1px solid var(--color-border-2); }
.picker-count { margin-right: auto; color: var(--color-text-3); font-size: 12px; }
.model-picker footer > button { height: 32px; padding: 0 14px; flex: 0 0 auto; border-radius: 10px; color: var(--color-text-2); background: var(--color-fill-2); }
.model-picker footer > button:hover:not(:disabled) { color: var(--color-primary); }
.picker-confirm { color: #fff !important; background: var(--color-primary) !important; }
.picker-confirm:hover:not(:disabled) { opacity: .9; }
.picker-confirm:disabled { opacity: .5; }
</style>
