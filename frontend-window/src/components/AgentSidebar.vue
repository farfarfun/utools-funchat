<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  ChatDotRound,
  Clock,
  Close,
  Download,
  Expand,
  Fold,
  FullScreen,
  Lock,
  Minus,
  Moon,
  MoreFilled,
  Plus,
  Search,
  Sunny,
  Unlock,
} from '@element-plus/icons-vue';

const props = defineProps({
  agents: { type: Array, default: () => [] },
  activeCode: { type: String, default: '' },
  histories: { type: Array, default: () => [] },
  favicon: { type: String, default: '' },
  conversationName: { type: String, default: '' },
  isAlwaysOnTop: Boolean,
  autoCloseOnBlur: Boolean,
  isDark: Boolean,
  loading: Boolean,
});

const emit = defineEmits([
  'select-agent',
  'select-history',
  'new-chat',
  'toggle-theme',
  'save-window-size',
  'save-session',
  'toggle-pin',
  'toggle-always-on-top',
  'open-model-dialog',
  'show-system-prompt',
  'open-search',
  'minimize',
  'maximize',
  'close',
]);

const collapsed = ref(window.innerWidth < 760);
const currentView = ref('agents');
const query = ref('');
let wasNarrow = window.innerWidth < 760;

const handleResize = () => {
  const isNarrow = window.innerWidth < 760;
  if (isNarrow !== wasNarrow) collapsed.value = isNarrow;
  wasNarrow = isNarrow;
};

onMounted(() => window.addEventListener('resize', handleResize));
onBeforeUnmount(() => window.removeEventListener('resize', handleResize));

const activeAgent = computed(() => props.agents.find(agent => agent.code === props.activeCode));
const filteredAgents = computed(() => {
  const keyword = query.value.trim().toLowerCase();
  return keyword
    ? props.agents.filter(agent => `${agent.code} ${agent.model || ''}`.toLowerCase().includes(keyword))
    : props.agents;
});
const filteredHistories = computed(() => {
  const keyword = query.value.trim().toLowerCase();
  return keyword
    ? props.histories.filter(file => file.basename.toLowerCase().includes(keyword))
    : props.histories;
});

const historyTitle = filename => filename.replace(/\.json$/i, '');
const historyTime = value => new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
}).format(new Date(value));

const showView = view => {
  currentView.value = view;
  if (view === 'history') collapsed.value = false;
};
</script>

<template>
  <aside class="agent-sidebar" :class="{ collapsed }" aria-label="聊天导航">
    <nav class="navigation-rail" aria-label="功能导航" @dblclick.self="emit('maximize')">
      <button class="profile-button no-drag" type="button" title="保存窗口位置" aria-label="保存窗口位置"
        @click="emit('save-window-size')">
        <img v-if="activeAgent?.icon || favicon" :src="activeAgent?.icon || favicon" alt="">
        <ChatDotRound v-else />
      </button>

      <div class="rail-primary no-drag">
        <button class="rail-button" :class="{ active: currentView === 'agents' }" type="button" title="好友列表"
          aria-label="好友列表" @click="showView('agents')"><ChatDotRound /></button>
        <button class="rail-button" type="button" title="新建对话" aria-label="新建对话"
          @click="emit('new-chat')"><Plus /></button>
        <button class="rail-button" :class="{ active: currentView === 'history' }" type="button" title="聊天记录"
          aria-label="聊天记录" @click="showView('history')"><Clock /></button>
        <button class="rail-button" type="button" title="搜索消息" aria-label="搜索消息"
          @click="emit('open-search')"><Search /></button>
      </div>

      <div class="rail-secondary no-drag">
        <button class="rail-button" type="button" :title="isDark ? '切换浅色主题' : '切换深色主题'"
          :aria-label="isDark ? '切换浅色主题' : '切换深色主题'"
          @click="emit('toggle-theme', !isDark)">
          <Sunny v-if="isDark" />
          <Moon v-else />
        </button>

        <details class="window-menu">
          <summary class="rail-button" title="更多" aria-label="更多"><MoreFilled /></summary>
          <div class="window-menu-panel">
            <button type="button" @click="emit('open-model-dialog')">切换模型</button>
            <button type="button" @click="emit('show-system-prompt')">系统提示词</button>
            <button type="button" @click="emit('save-session')"><Download />保存对话</button>
            <button type="button" @click="emit('toggle-pin')">
              <Unlock v-if="autoCloseOnBlur" /><Lock v-else />{{ autoCloseOnBlur ? '保持窗口' : '失焦关闭' }}
            </button>
            <button type="button" @click="emit('toggle-always-on-top')">
              <Lock />{{ isAlwaysOnTop ? '取消置顶' : '窗口置顶' }}
            </button>
            <button type="button" @click="emit('minimize')"><Minus />最小化</button>
            <button type="button" @click="emit('maximize')"><FullScreen />最大化</button>
            <button class="danger" type="button" @click="emit('close')"><Close />关闭窗口</button>
          </div>
        </details>
      </div>
    </nav>

    <section class="agent-pane" aria-label="好友与记录">
      <header class="pane-toolbar">
        <label v-if="!collapsed" class="pane-search">
          <Search />
          <input v-model="query" type="search" :placeholder="currentView === 'agents' ? '搜索好友' : '搜索记录'"
            :aria-label="currentView === 'agents' ? '搜索好友' : '搜索记录'">
        </label>
        <button v-if="currentView === 'agents'" class="add-button" type="button" title="新建对话" aria-label="新建对话"
          @click="emit('new-chat')"><Plus /></button>
      </header>

      <div v-if="currentView === 'agents'" class="pane-list custom-scrollbar" role="tablist" aria-label="好友列表">
        <button v-for="agent in filteredAgents" :key="agent.code" class="agent-item"
          :class="{ active: agent.code === activeCode }" type="button" role="tab"
          :aria-selected="agent.code === activeCode" :title="agent.code" @click="emit('select-agent', agent.code)">
          <span class="agent-avatar">
            <img v-if="agent.icon" :src="agent.icon" alt="">
            <ChatDotRound v-else />
          </span>
          <span v-if="!collapsed" class="agent-copy">
            <strong>{{ agent.code }}</strong>
            <small>{{ agent.model || '默认模型' }}</small>
          </span>
        </button>
        <p v-if="!filteredAgents.length && !collapsed" class="empty-list">查无此人</p>
      </div>

      <div v-else class="pane-list history-list custom-scrollbar" aria-label="聊天记录">
        <div class="history-summary">
          <strong>{{ activeCode || '当前好友' }}</strong>
          <span>{{ filteredHistories.length }} 条记录</span>
        </div>
        <button class="history-item new-history" type="button" @click="emit('new-chat')">
          <Plus />
          <span><strong>新建对话</strong><small>开始一个空白会话</small></span>
        </button>
        <button v-for="file in filteredHistories" :key="file.path" class="history-item" type="button"
          :disabled="loading" :title="historyTitle(file.basename)" @click="emit('select-history', file)">
          <Clock />
          <span><strong>{{ historyTitle(file.basename) }}</strong><small>{{ historyTime(file.lastmod) }}</small></span>
        </button>
        <p v-if="!filteredHistories.length" class="empty-list">暂无对话记录</p>
      </div>

      <button class="collapse-trigger" type="button" :title="collapsed ? '展开好友栏' : '收起好友栏'"
        :aria-label="collapsed ? '展开好友栏' : '收起好友栏'" @click="collapsed = !collapsed">
        <Expand v-if="collapsed" />
        <Fold v-else />
      </button>
    </section>
  </aside>
</template>

<style scoped>
.agent-sidebar {
  width: 252px;
  min-width: 252px;
  height: 100%;
  display: flex;
  color: var(--color-text-2);
  transition: width 180ms ease, min-width 180ms ease;
}

.agent-sidebar.collapsed {
  width: 117px;
  min-width: 117px;
}

.navigation-rail {
  position: relative;
  z-index: 20;
  width: 52px;
  min-width: 52px;
  height: 100%;
  padding: 16px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--color-bg-3);
  border-right: 1px solid var(--color-border-2);
  -webkit-app-region: drag;
}

.profile-button,
.rail-button,
.add-button,
.collapse-trigger {
  border: 0;
  color: var(--color-icon);
  background: transparent;
  cursor: pointer;
}

.profile-button {
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.profile-button img,
.profile-button svg {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-button svg {
  padding: 5px;
  color: rgb(var(--primary-6));
  background: var(--color-primary-light-1);
}

.rail-primary,
.rail-secondary {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.rail-primary {
  margin-top: 28px;
}

.rail-secondary {
  margin-top: auto;
}

.rail-button {
  width: 36px;
  height: 36px;
  padding: 8px;
  border-radius: 8px;
  display: grid;
  place-items: center;
}

.rail-button svg {
  width: 20px;
  height: 20px;
}

.rail-button:hover,
.rail-button.active,
.window-menu[open] > .rail-button {
  color: rgb(var(--primary-6));
  background: var(--color-primary-light-1);
}

.window-menu {
  position: relative;
}

.window-menu > summary {
  list-style: none;
}

.window-menu > summary::-webkit-details-marker {
  display: none;
}

.window-menu-panel {
  position: absolute;
  left: 44px;
  bottom: 0;
  width: 180px;
  padding: 6px;
  border: 1px solid var(--color-border-2);
  border-radius: 8px;
  background: var(--color-bg-5);
  box-shadow: 0 4px 10px rgba(0, 0, 0, .1);
}

.window-menu-panel button {
  width: 100%;
  min-height: 34px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--color-text-2);
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.window-menu-panel button:hover {
  background: var(--color-fill-2);
}

.window-menu-panel button svg {
  width: 16px;
}

.window-menu-panel button:first-child,
.window-menu-panel button:nth-child(2) {
  padding-left: 35px;
}

.window-menu-panel button.danger:hover {
  color: rgb(var(--danger-6));
  background: var(--color-danger-light-1);
}

.no-drag,
.no-drag * {
  -webkit-app-region: no-drag;
}

.agent-pane {
  width: 200px;
  min-width: 200px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-bg-3);
  border-right: 1px solid var(--color-border-2);
  transition: width 180ms ease, min-width 180ms ease;
}

.collapsed .agent-pane {
  width: 65px;
  min-width: 65px;
}

.pane-toolbar {
  height: 60px;
  min-height: 60px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.pane-search {
  min-width: 0;
  height: 34px;
  flex: 1;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--color-border-2);
  border-radius: 4px;
  color: var(--color-icon);
  background: var(--color-bg-3);
}

.pane-search:focus-within {
  border-color: rgb(var(--primary-6));
}

.pane-search svg {
  width: 15px;
  flex: 0 0 15px;
}

.pane-search input {
  min-width: 0;
  width: 100%;
  border: 0;
  outline: 0;
  color: var(--color-text-2);
  background: transparent;
  font: inherit;
}

.pane-search input::placeholder {
  color: var(--color-text-3);
}

.add-button {
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  padding: 9px;
  border-radius: 4px;
  color: rgb(var(--warning-6));
  background: var(--color-warning-light-1);
}

.add-button:hover {
  background: var(--color-warning-light-2);
}

.collapsed .pane-toolbar {
  padding: 12px 14px;
}

.pane-list {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
}

.agent-item {
  width: 100%;
  height: 60px;
  padding: 0 16px;
  border: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  color: inherit;
  background: transparent;
  text-align: left;
  font: inherit;
  cursor: pointer;
}

.agent-item:hover {
  background: var(--color-fill-1);
}

.agent-item.active {
  background: var(--color-fill-2);
}

.collapsed .agent-item {
  padding: 0 14px;
  justify-content: center;
}

.agent-avatar {
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  overflow: hidden;
  color: rgb(var(--primary-6));
  background: var(--color-primary-light-1);
}

.agent-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.agent-avatar svg {
  width: 19px;
  height: 19px;
}

.agent-copy,
.history-item span {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
}

.agent-copy strong,
.history-item strong {
  overflow: hidden;
  color: var(--color-text-2);
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-copy small,
.history-item small {
  margin-top: 4px;
  overflow: hidden;
  color: var(--color-text-3);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-summary {
  height: 52px;
  padding: 4px 14px 10px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-bottom: 1px solid var(--color-border-2);
}

.history-summary strong {
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-summary span {
  margin-top: 3px;
  color: var(--color-text-3);
  font-size: 11px;
}

.history-item {
  width: 100%;
  height: 71px;
  padding: 0 14px;
  border: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--color-icon);
  background: transparent;
  text-align: left;
  font: inherit;
  cursor: pointer;
}

.history-item:hover {
  background: var(--color-fill-1);
}

.history-item:disabled {
  opacity: .5;
  cursor: wait;
}

.history-item > svg {
  width: 18px;
  flex: 0 0 18px;
}

.new-history {
  color: rgb(var(--primary-6));
}

.empty-list {
  margin: 28px 14px;
  color: var(--color-text-3);
  font-size: 12px;
  text-align: center;
}

.collapse-trigger {
  height: 36px;
  min-height: 36px;
  border-top: 1px solid var(--color-border-2);
  display: grid;
  place-items: center;
  background: var(--color-bg-3);
}

.collapse-trigger:hover {
  color: rgb(var(--primary-6));
  background: var(--color-fill-1);
}

.collapse-trigger svg {
  width: 15px;
}

button:focus-visible,
summary:focus-visible,
input:focus-visible {
  outline: 2px solid rgb(var(--primary-6));
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .agent-sidebar,
  .agent-pane {
    transition: none;
  }
}
</style>
