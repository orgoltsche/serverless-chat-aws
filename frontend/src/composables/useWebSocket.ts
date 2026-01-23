import { ref, onUnmounted } from 'vue';

export interface Message {
  roomId: string;
  messageId: string;
  userId: string;
  username: string;
  content: string;
  createdAt: number;
}

const socket = ref<WebSocket | null>(null);
const isConnected = ref(false);
const messages = ref<Message[]>([]);
const connectionError = ref<string | null>(null);
const env = (import.meta as any)?.env ?? {};
const isTestEnv = env.MODE === 'test' || env.NODE_ENV === 'test' || process.env.NODE_ENV === 'test';
const logError = (...args: unknown[]) => {
  if (!isTestEnv) console.error(...args);
};

export function useWebSocket() {
  function connect(userId: string, username: string): void {
    const runtimeEnv = {
      ...(import.meta as any)?.env,
      ...(globalThis as any).import?.meta?.env,
      ...(process.env as any),
    };
    const wsUrl = runtimeEnv?.VITE_WEBSOCKET_URL;
    if (!wsUrl) {
      connectionError.value = 'WebSocket URL not configured';
      return;
    }

    const url = `${wsUrl}?userId=${encodeURIComponent(userId)}&username=${encodeURIComponent(username)}`;

    try {
      socket.value = new WebSocket(url);

      socket.value.onopen = () => {
        isConnected.value = true;
        connectionError.value = null;
        console.log('WebSocket connected');
        getMessages();
      };

      socket.value.onclose = () => {
        isConnected.value = false;
        console.log('WebSocket disconnected');
      };

      socket.value.onerror = (event) => {
        logError('WebSocket error:', event);
        connectionError.value = 'Connection error';
      };

      socket.value.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleMessage(data);
        } catch (e) {
          logError('Failed to parse message:', e);
        }
      };
    } catch (e) {
      connectionError.value = 'Failed to connect';
      logError('WebSocket connection error:', e);
    }
  }

  function handleMessage(data: { type: string; data: unknown }): void {
    switch (data.type) {
      case 'messageHistory':
        messages.value = data.data as Message[];
        break;
      case 'newMessage':
        messages.value.push(data.data as Message);
        break;
      default:
        console.log('Unknown message type:', data.type);
        connectionError.value = 'Unknown message type';
    }
  }

  function sendMessage(content: string, roomId = 'global'): void {
    if (!socket.value || socket.value.readyState !== WebSocket.OPEN) {
      logError('WebSocket not connected');
      return;
    }

    socket.value.send(
      JSON.stringify({
        action: 'sendMessage',
        data: { content, roomId },
      })
    );
  }

  function getMessages(roomId = 'global', limit = 50): void {
    if (!socket.value || socket.value.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.value.send(
      JSON.stringify({
        action: 'getMessages',
        data: { roomId, limit },
      })
    );
  }

  function disconnect(): void {
    socket.value?.close();
    socket.value = null;
    isConnected.value = false;
    messages.value = [];
    connectionError.value = null;
  }

  onUnmounted(() => {
    disconnect();
  });

  return {
    socket,
    isConnected,
    messages,
    connectionError,
    connect,
    sendMessage,
    getMessages,
    disconnect,
  };
}
