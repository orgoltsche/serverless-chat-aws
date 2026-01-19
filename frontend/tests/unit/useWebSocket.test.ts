import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
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

    const { disconnect, connectionError, messages, isConnected } = useWebSocket();
    disconnect();
    connectionError.value = null;
    messages.value = [];
    isConnected.value = false;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('connects and receives history and new messages', async () => {
    const { connect, isConnected, messages, getMessages, sendMessage } = useWebSocket();

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
    const { connect, disconnect, isConnected, connectionError } = useWebSocket();
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
    const { connect, sendMessage, getMessages, connectionError } = useWebSocket();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    connect('u', 'User');
    expect(connectionError.value).toBe('WebSocket URL not configured');
    expect(lastSocket).toBeNull();

    sendMessage('hello');
    getMessages();

    expect(errorSpy).toHaveBeenCalled();
    expect(lastSocket).toBeNull();

    errorSpy.mockRestore();
  });

  it('logs unknown message types and ignores bad payloads', async () => {
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { connect, connectionError } = useWebSocket();
    (global as any).import.meta.env.VITE_WEBSOCKET_URL = 'wss://test.example.com';
    connectionError.value = null;

    connect('user-1', 'TestUser');
    await vi.runAllTimersAsync();

    lastSocket?.emitMessage({ type: 'unknown', data: {} });
    lastSocket?.onmessage?.({ data: '{bad json}' } as MessageEvent);

    lastSocket?.onmessage?.({ data: JSON.stringify({ type: 'unknown', data: {} }) } as MessageEvent);

    expect(connectionError.value).toBe('Unknown message type');
    expect(consoleErr).toHaveBeenCalled();

    consoleErr.mockRestore();
  });

  it('sets connection error when websocket creation fails', () => {
    (global as any).import.meta.env.VITE_WEBSOCKET_URL = 'wss://test.example.com';
    vi.stubGlobal('WebSocket', vi.fn(() => { throw new Error('boom'); }) as any);
    const { connect, connectionError } = useWebSocket();

    connect('user', 'User');

    expect(connectionError.value).toBe('Failed to connect');
  });

  it('disconnects on component unmount', () => {
    const { isConnected } = useWebSocket();
    isConnected.value = true;
    const wrapper = mount(
      defineComponent({
        setup() {
          useWebSocket();
          return () => null;
        },
      })
    );

    wrapper.unmount();
    expect(isConnected.value).toBe(false);
  });
});
