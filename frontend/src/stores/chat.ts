import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface User {
  id: string;
  email: string;
  nickname: string;
}

export const useChatStore = defineStore('chat', () => {
  const user = ref<User | null>(null);
  const currentRoom = ref('global');

  function setUser(newUser: User | null) {
    user.value = newUser;
  }

  function setCurrentRoom(roomId: string) {
    currentRoom.value = roomId;
  }

  function clearUser() {
    user.value = null;
  }

  return {
    user,
    currentRoom,
    setUser,
    setCurrentRoom,
    clearUser,
  };
});
