<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuth } from './composables/useAuth';
import { useChatStore } from './stores/chat';
import UserLogin from './components/UserLogin.vue';
import ChatRoom from './components/ChatRoom.vue';

const { isAuthenticated, username, checkSession, signOut } = useAuth();
const chatStore = useChatStore();
const isCheckingSession = ref(true);

onMounted(async () => {
  await checkSession();
  isCheckingSession.value = false;
});

function handleLogout() {
  signOut();
  chatStore.clearUser();
}
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <header class="bg-white shadow">
      <div class="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
        <h1 class="text-xl font-bold text-gray-900">
          Serverless Chat
        </h1>
        <div
          v-if="isAuthenticated"
          class="flex items-center gap-4"
        >
          <span class="text-gray-600">{{ username }}</span>
          <button
            class="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
            @click="handleLogout"
          >
            Logout
          </button>
        </div>
      </div>
    </header>

    <main class="max-w-4xl mx-auto px-4 py-8">
      <div
        v-if="isCheckingSession"
        class="text-center py-12"
      >
        <p class="text-gray-500">
          Loading...
        </p>
      </div>

      <UserLogin v-else-if="!isAuthenticated" />

      <ChatRoom v-else />
    </main>
  </div>
</template>
