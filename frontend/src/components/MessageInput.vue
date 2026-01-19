<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  disabled: boolean;
}>();

const emit = defineEmits<{
  send: [content: string];
}>();

const input = ref('');

function handleSubmit() {
  const content = input.value.trim();
  if (content) {
    emit('send', content);
    input.value = '';
  }
}
</script>

<template>
  <form
    class="p-4 flex gap-2"
    @submit.prevent="handleSubmit"
  >
    <input
      v-model="input"
      type="text"
      :disabled="disabled"
      placeholder="Type a message..."
      class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
    >
    <button
      type="submit"
      :disabled="disabled || !input.trim()"
      class="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition"
    >
      Send
    </button>
  </form>
</template>
