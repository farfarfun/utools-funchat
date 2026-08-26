<script setup>
import { onBeforeUnmount, onMounted } from 'vue';
import AgentList from './features/agents/AgentList.vue';
import ChatView from './features/chat/ChatView.vue';
import FeatureView from './features/navigation/FeatureView.vue';
import SideMenu from './features/navigation/SideMenu.vue';
import SettingsView from './features/settings/SettingsView.vue';
import { useChatStore } from './stores/chat.js';

const store = useChatStore();
const logoUrl = `${import.meta.env.BASE_URL}logo.png`;

function handleShortcut(event) {
  if (event.defaultPrevented || event.altKey || document.querySelector('dialog[open]')) return;
  const modifier = event.ctrlKey || event.metaKey;
  if (modifier && !event.shiftKey) {
    const actions = {
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

onMounted(async () => {
  document.addEventListener('keydown', handleShortcut);
  try {
    await store.init();
  } catch (error) {
    store.state.error = error.message || String(error);
    store.state.ready = true;
  }
});
onBeforeUnmount(() => document.removeEventListener('keydown', handleShortcut));
</script>

<template>
  <div v-if="!store.state.ready" class="app-loading"><img :src="logoUrl" alt=""><span>funchat</span></div>
  <div v-else class="app-shell">
    <div v-if="store.state.error && !store.state.agents.length" class="fatal-error" role="alert">{{ store.state.error }}</div>
    <SideMenu v-if="store.state.view !== 'chat' || !store.state.sidebarCollapsed"
      :active="store.state.view" @navigate="store.state.view = $event" />
    <template v-if="store.state.view === 'chat'">
      <AgentList />
      <ChatView />
    </template>
    <SettingsView v-else-if="store.state.view === 'settings'" />
    <FeatureView v-else :view="store.state.view" />
  </div>
</template>
