<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import AgentList from './features/agents/AgentList.vue';
import ChatView from './features/chat/ChatView.vue';
import FeatureView from './features/navigation/FeatureView.vue';
import SideMenu from './features/navigation/SideMenu.vue';
import SettingsView from './features/settings/SettingsView.vue';
import { useChatStore } from './stores/chat.js';

const store = useChatStore();
const logoUrl = `${import.meta.env.BASE_URL}logo.png`;

function handleShortcut(event: KeyboardEvent) {
  if (event.defaultPrevented || event.altKey || document.querySelector('dialog[open]')) return;
  const modifier = event.ctrlKey || event.metaKey;
  if (modifier && !event.shiftKey) {
    const actions: Record<string, () => void> = {
      n: () => store.newConversation(),
      b: () => { store.state.sidebarCollapsed = !store.state.sidebarCollapsed; },
      h: () => { store.state.historyOpen = !store.state.historyOpen; },
    };
    const action = actions[event.key.toLowerCase()];
    if (!action) return;
    event.preventDefault();
    store.state.view = 'chat';
    action();
    return;
  }
  if (event.shiftKey && !modifier && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault();
    store.cycleAgent(event.key === 'ArrowUp' ? -1 : 1);
  }
}

// 流式回复期间会话还没落盘（persistCurrentConversation 要等流结束才调用），
// 此时关掉窗口整轮问答都会丢，所以卸载前补存一次。pagehide 在 Electron 关窗时会触发。
function persistBeforeUnload() {
  store.persistCurrentConversation();
}

onMounted(async () => {
  document.addEventListener('keydown', handleShortcut);
  window.addEventListener('pagehide', persistBeforeUnload);
  try {
    await store.init();
  } catch (error) {
    store.state.error = error instanceof Error ? error.message : String(error);
    store.state.ready = true;
  }
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleShortcut);
  window.removeEventListener('pagehide', persistBeforeUnload);
});
</script>

<template>
  <div v-if="!store.state.ready" class="app-loading"><img :src="logoUrl" alt=""><span>funchat</span></div>
  <div v-else class="app-shell">
    <div v-if="store.state.error && !store.state.agents.length" class="fatal-error" role="alert">{{ store.state.error }}</div>
    <SideMenu v-if="store.state.view !== 'chat' || !store.state.sidebarCollapsed"
      :active="store.state.view" @navigate="store.state.view = $event" />
    <Transition name="page" mode="out-in">
      <div class="view-pane" :key="store.state.view">
        <template v-if="store.state.view === 'chat'">
          <AgentList />
          <ChatView />
        </template>
        <SettingsView v-else-if="store.state.view === 'settings'" />
        <FeatureView v-else :view="store.state.view" />
      </div>
    </Transition>
  </div>
</template>
