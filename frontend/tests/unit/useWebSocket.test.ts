import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, type ComponentPublicInstance } from 'vue';
import { useWebSocket } from '../../src/composables/useWebSocket';

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;

  url: string;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    setTimeout(() => this.onopen?.(), 0);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  emitMessage(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  triggerError(message: string) {
    this.onerror?.(new Error(message) as any);
  }
}

let lastSocket: MockWebSocket | null = null;
let wrapper: ReturnType<typeof mount> | null = null;
let composable: ReturnType<typeof useWebSocket>;

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    lastSocket = null;
    vi.stubGlobal('import', {
      meta: {
        env: {
          VITE_WEBSOCKET_URL: 'wss://test.example.com',
        },
      },
    });
    vi.stubGlobal('WebSocket', class extends MockWebSocket {
      constructor(url: string) {
        super(url);
        lastSocket = this;
      }
    } as any);

    const Comp = defineComponent({
      setup() {
        composable = useWebSocket();
        return () => null;
      },
    });

    wrapper = mount(Comp);

    composable.disconnect();
    composable.connectionError.value = null;
    composable.messages.value = [];
    composable.isConnected.value = false;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    wrapper?.unmount();
    wrapper = null;
  });

  it('connects and receives history and new messages', async () => {
    const { connect, isConnected, messages, getMessages, sendMessage } = composable;

    connect('user-1', 'TestUser');
    await vi.runAllTimersAsync();

    expect(isConnected.value).toBe(true);
    expect(lastSocket?.url).toContain('userId=user-1');

    sendMessage('Hello', 'room-1');
    expect(lastSocket?.sentMessages.some((msg) => msg.includes('"action":"sendMessage"'))).toBe(true);

    lastSocket?.emitMessage({
      type: 'messageHistory',
      data: [{ messageId: '1', content: 'Hi', createdAt: 1, username: 'A', userId: 'u', roomId: 'global' }],
    });
    lastSocket?.emitMessage({
      type: 'newMessage',
      data: { messageId: '2', content: 'Yo', createdAt: 2, username: 'B', userId: 'u2', roomId: 'global' },
    });

    expect(messages.value).toHaveLength(2);

    getMessages('global', 10);
    expect(lastSocket?.sentMessages.at(-1)).toContain('"action":"getMessages"');
  });

  it('handles errors and disconnect', async () => {
    const { connect, disconnect, isConnected, connectionError } = composable;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    connect('user-1', 'TestUser');
    await vi.runAllTimersAsync();

    lastSocket?.triggerError('boom');
    expect(connectionError.value).toBe('Connection error');

    disconnect();
    expect(isConnected.value).toBe(false);
    expect(connectionError.value).toBeNull();

    consoleSpy.mockRestore();
  });

  it('rejects missing websocket url and prevents sends when disconnected', () => {
    (global as any).import.meta.env.VITE_WEBSOCKET_URL = '';
    const { connect, sendMessage, getMessages, connectionError } = composable;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    connect('u', 'User');
    expect(connectionError.value).toBe('WebSocket URL not configured');
    expect(lastSocket).toBeNull();

    sendMessage('hello');
    getMessages();

    expect(lastSocket).toBeNull();

    errorSpy.mockRestore();
  });

  it('logs unknown message types and ignores bad payloads', async () => {
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { connect, connectionError } = composable;
    (global as any).import.meta.env.VITE_WEBSOCKET_URL = 'wss://test.example.com';
    connectionError.value = null;

    connect('user-1', 'TestUser');
    await vi.runAllTimersAsync();

    lastSocket?.emitMessage({ type: 'unknown', data: {} });
    lastSocket?.onmessage?.({ data: '{bad json}' } as MessageEvent);

    lastSocket?.onmessage?.({ data: JSON.stringify({ type: 'unknown', data: {} }) } as MessageEvent);

    expect(connectionError.value).toBe('Unknown message type');

    consoleErr.mockRestore();
  });

  it('sets connection error when websocket creation fails', () => {
    (global as any).import.meta.env.VITE_WEBSOCKET_URL = 'wss://test.example.com';
    class FailingWebSocket {
      constructor() {
        throw new Error('boom');
      }
    }
    vi.stubGlobal('WebSocket', FailingWebSocket as any);

    let local: ReturnType<typeof useWebSocket>;
    const Comp = defineComponent({
      setup() {
        local = useWebSocket();
        return () => null;
      },
    });
    const localWrapper = mount(Comp);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { connect, connectionError } = local!;

    connect('user', 'User');

    expect(connectionError.value).toBe('Failed to connect');
    consoleSpy.mockRestore();
    localWrapper.unmount();
  });

  it('disconnects on component unmount', () => {
    const { isConnected } = composable;
    isConnected.value = true;

    wrapper?.unmount();
    expect(isConnected.value).toBe(false);
  });
});
