<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import type { Message } from '../composables/useWebSocket';

const props = defineProps<{
  messages: Message[];
}>();

const listRef = ref<HTMLElement | null>(null);

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

watch(
  () => props.messages.length,
  async () => {
    await nextTick();
    if (listRef.value) {
      listRef.value.scrollTop = listRef.value.scrollHeight;
    }
  }
);
</script>

<template>
  <div
    ref="listRef"
    class="p-4 space-y-3"
  >
    <div
      v-if="messages.length === 0"
      class="text-center text-gray-400 py-8"
    >
      No messages yet. Start the conversation!
    </div>

    <div
      v-for="message in messages"
      :key="message.messageId"
      class="flex gap-3"
    >
      <div
        class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
      >
        {{ message.username.charAt(0).toUpperCase() }}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-baseline gap-2">
          <span class="font-medium text-gray-900">
            {{ message.username }}
          </span>
          <span class="text-xs text-gray-400">
            {{ formatTime(message.createdAt) }}
          </span>
        </div>
        <p class="text-gray-700 break-words">
          {{ message.content }}
        </p>
      </div>
    </div>
  </div>
</template>
