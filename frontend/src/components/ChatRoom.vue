<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useWebSocket } from '../composables/useWebSocket';
import { useAuth } from '../composables/useAuth';
import MessageList from './MessageList.vue';
import MessageInput from './MessageInput.vue';

const { username } = useAuth();
const { isConnected, messages, connectionError, connect, sendMessage, disconnect } = useWebSocket();

onMounted(() => {
  const userId = username.value || 'anonymous';
  const displayName = username.value || 'Anonymous';
  connect(userId, displayName);
});

onUnmounted(() => {
  disconnect();
});

function handleSend(content: string) {
  sendMessage(content);
}
</script>

<template>
  <div class="bg-white rounded-lg shadow h-[600px] flex flex-col">
    <div class="px-4 py-3 border-b flex items-center justify-between">
      <h2 class="font-semibold">
        Global Chat
      </h2>
      <div class="flex items-center gap-2">
        <span
          :class="[
            'w-2 h-2 rounded-full',
            isConnected ? 'bg-green-500' : 'bg-red-500'
          ]"
        />
        <span class="text-sm text-gray-500">
          {{ isConnected ? 'Connected' : 'Disconnected' }}
        </span>
      </div>
    </div>

    <div
      v-if="connectionError"
      class="px-4 py-2 bg-red-50 text-red-600 text-sm"
    >
      {{ connectionError }}
    </div>

    <MessageList
      :messages="messages"
      class="flex-1 overflow-y-auto"
    />

    <MessageInput
      :disabled="!isConnected"
      class="border-t"
      @send="handleSend"
    />
  </div>
</template>
