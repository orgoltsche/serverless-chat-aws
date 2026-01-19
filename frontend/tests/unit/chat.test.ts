import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useChatStore } from '../../src/stores/chat';

describe('Chat Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('should initialize with null user', () => {
    const store = useChatStore();
    expect(store.user).toBeNull();
  });

  it('should initialize with global room', () => {
    const store = useChatStore();
    expect(store.currentRoom).toBe('global');
  });

  it('should set user correctly', () => {
    const store = useChatStore();
    const testUser = {
      id: 'user-123',
      email: 'test@example.com',
      nickname: 'TestUser',
    };

    store.setUser(testUser);

    expect(store.user).toEqual(testUser);
    expect(store.user?.id).toBe('user-123');
    expect(store.user?.nickname).toBe('TestUser');
  });

  it('should clear user correctly', () => {
    const store = useChatStore();
    store.setUser({
      id: 'user-123',
      email: 'test@example.com',
      nickname: 'TestUser',
    });

    store.clearUser();

    expect(store.user).toBeNull();
  });

  it('should change current room', () => {
    const store = useChatStore();

    store.setCurrentRoom('room-123');

    expect(store.currentRoom).toBe('room-123');
  });

  it('should handle multiple room changes', () => {
    const store = useChatStore();

    store.setCurrentRoom('room-1');
    expect(store.currentRoom).toBe('room-1');

    store.setCurrentRoom('room-2');
    expect(store.currentRoom).toBe('room-2');

    store.setCurrentRoom('global');
    expect(store.currentRoom).toBe('global');
  });
});

describe('Message Formatting', () => {
  it('should format timestamp correctly', () => {
    const timestamp = new Date('2024-01-15T14:30:00').getTime();
    const formatted = new Date(timestamp).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });

    expect(formatted).toMatch(/^\d{2}:\d{2}$/);
  });

  it('should extract first character for avatar', () => {
    const username = 'TestUser';
    const initial = username.charAt(0).toUpperCase();

    expect(initial).toBe('T');
  });

  it('should handle empty username for avatar', () => {
    const username = '';
    const initial = username.charAt(0).toUpperCase() || '?';

    expect(initial).toBe('?');
  });
});
