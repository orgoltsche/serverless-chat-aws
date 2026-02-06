import { ref, onUnmounted } from 'vue';

export interface Message {
  roomId: string;
  messageId: string;
  userId: string;
  username: string;
  content: string;
  createdAt: number;
}

type RuntimeEnv = {
  VITE_WEBSOCKET_URL?: string;
  MODE?: string;
  NODE_ENV?: string;
};

function getRuntimeEnv(): RuntimeEnv {
  const procEnv = (globalThis as unknown as { process?: { env?: Record<string, unknown> } })
    .process?.env;
  const merged: Record<string, unknown> = { ...(procEnv || {}), ...import.meta.env };

  const getString = (k: keyof RuntimeEnv) => {
    const v = merged[k as string];
    return typeof v === 'string' ? v : undefined;
  };

  return {
    VITE_WEBSOCKET_URL: getString('VITE_WEBSOCKET_URL'),
    MODE: getString('MODE'),
    NODE_ENV: getString('NODE_ENV'),
  };
}

const socket = ref<WebSocket | null>(null);
const isConnected = ref(false);
const messages = ref<Message[]>([]);
const connectionError = ref<string | null>(null);
const startupEnv = getRuntimeEnv();
const isTestEnv =
  startupEnv.MODE === 'test' ||
  startupEnv.NODE_ENV === 'test';
const logError = (...args: unknown[]) => {
  if (!isTestEnv) console.error(...args);
};

export function useWebSocket() {
  function connect(userId: string, username: string): void {
    const runtimeEnv = getRuntimeEnv();
    const wsUrl = runtimeEnv.VITE_WEBSOCKET_URL;
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
          const parsed: unknown = JSON.parse(event.data);
          handleMessage(parsed);
        } catch (e) {
          logError('Failed to parse message:', e);
        }
      };
    } catch (e) {
      connectionError.value = 'Failed to connect';
      logError('WebSocket connection error:', e);
    }
  }

  function handleMessage(msg: unknown): void {
    if (!msg || typeof msg !== 'object') {
      connectionError.value = 'Invalid message';
      return;
    }

    const type = (msg as { type?: unknown }).type;
    const data = (msg as { data?: unknown }).data;

    if (typeof type !== 'string') {
      connectionError.value = 'Invalid message type';
      return;
    }

    switch (type) {
      case 'messageHistory':
        messages.value = (Array.isArray(data) ? (data as Message[]) : []);
        break;
      case 'newMessage':
        messages.value.push(data as Message);
        break;
      default:
        console.log('Unknown message type:', type);
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
