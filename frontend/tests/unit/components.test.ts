import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref, nextTick } from 'vue';
import MessageInput from '../../src/components/MessageInput.vue';
import MessageList from '../../src/components/MessageList.vue';
import ChatRoom from '../../src/components/ChatRoom.vue';
import UserLogin from '../../src/components/UserLogin.vue';
import App from '../../src/App.vue';

const wsState = {
  socket: ref(null),
  isConnected: ref(false),
  messages: ref<any[]>([]),
  connectionError: ref<string | null>(null),
  connect: vi.fn(),
  sendMessage: vi.fn(),
  getMessages: vi.fn(),
  disconnect: vi.fn(),
};

const authMock = {
  isAuthenticated: ref(false),
  username: ref<string | null>('Tester'),
  checkSession: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn(),
  signUp: vi.fn().mockResolvedValue(undefined),
  signIn: vi.fn().mockResolvedValue(undefined),
  confirmSignUp: vi.fn().mockResolvedValue(undefined),
  isLoading: ref(false),
  error: ref<string | null>(null),
};

const storeMock = {
  user: ref(null),
  currentRoom: ref('global'),
  setUser: vi.fn((user) => {
    storeMock.user.value = user;
  }),
  setCurrentRoom: vi.fn((room) => {
    storeMock.currentRoom.value = room;
  }),
  clearUser: vi.fn(() => {
    storeMock.user.value = null;
  }),
};

vi.mock('../../src/composables/useWebSocket', () => ({
  useWebSocket: () => wsState,
}));

vi.mock('../../src/composables/useAuth', () => ({
  useAuth: () => authMock,
}));

vi.mock('../../src/stores/chat', () => ({
  useChatStore: () => storeMock,
}));

describe('MessageInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits trimmed content and clears input', async () => {
    const wrapper = mount(MessageInput, { props: { disabled: false } });
    const input = wrapper.find('input');

    await input.setValue('  Hello World  ');
    await wrapper.find('form').trigger('submit.prevent');

    expect(wrapper.emitted('send')?.[0][0]).toBe('Hello World');
    expect((input.element as HTMLInputElement).value).toBe('');
  });

  it('ignores empty messages', async () => {
    const wrapper = mount(MessageInput, { props: { disabled: false } });
    await wrapper.find('input').setValue('   ');
    await wrapper.find('form').trigger('submit.prevent');

    expect(wrapper.emitted('send')).toBeUndefined();
  });
});

describe('MessageList', () => {
  it('renders list and empty state', () => {
    const messages = [
      { messageId: '1', content: 'First', username: 'Alice', createdAt: 1, roomId: 'global', userId: 'a' },
      { messageId: '2', content: 'Second', username: 'Bob', createdAt: 2, roomId: 'global', userId: 'b' },
    ];

    const wrapper = mount(MessageList, { props: { messages } });
    expect(wrapper.text()).toContain('First');
    expect(wrapper.text()).toContain('Second');

    const emptyWrapper = mount(MessageList, { props: { messages: [] } });
    expect(emptyWrapper.text()).toContain('No messages yet');
  });

  it('scrolls to bottom when messages change', async () => {
    const wrapper = mount(MessageList, { props: { messages: [] } });
    const el = wrapper.element as HTMLElement;
    let scrollPos = 0;
    Object.defineProperty(el, 'scrollHeight', { configurable: true, value: 50 });
    Object.defineProperty(el, 'scrollTop', {
      configurable: true,
      get: () => scrollPos,
      set: (v) => {
        scrollPos = v;
      },
    });

    await wrapper.setProps({
      messages: [{ messageId: '1', content: 'Hi', username: 'Test', createdAt: Date.now(), roomId: 'global', userId: 'u' }],
    });
    await nextTick();

    expect((wrapper.element as HTMLElement).scrollTop).toBe(50);
  });
});

describe('ChatRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wsState.isConnected.value = false;
    wsState.messages.value = [];
    wsState.connectionError.value = null;
    authMock.username.value = 'Tester';
  });

  it('connects on mount and disconnects on unmount', async () => {
    const wrapper = mount(ChatRoom);
    expect(wsState.connect).toHaveBeenCalledWith('Tester', 'Tester');

    wsState.isConnected.value = true;
    await nextTick();
    expect(wrapper.text()).toContain('Connected');

    wsState.connectionError.value = 'Boom';
    await nextTick();
    expect(wrapper.text()).toContain('Boom');

    wsState.messages.value = [
      { messageId: '1', content: 'Hello', username: 'Tester', createdAt: Date.now(), roomId: 'global', userId: 'u' },
    ];
    await nextTick();
    expect(wrapper.text()).toContain('Hello');

    await wrapper.find('input').setValue('Hi');
    await wrapper.find('form').trigger('submit.prevent');
    expect(wsState.sendMessage).toHaveBeenCalledWith('Hi');

    wrapper.unmount();
    expect(wsState.disconnect).toHaveBeenCalled();
  });

  it('uses fallback user values when username is missing', () => {
    authMock.username.value = null;
    wsState.connect.mockClear();

    mount(ChatRoom);

    expect(wsState.connect).toHaveBeenCalledWith('anonymous', 'Anonymous');
  });
});

describe('UserLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.isLoading.value = false;
    authMock.error.value = null;
    storeMock.user.value = null;
  });

  it('logs in a user', async () => {
    const wrapper = mount(UserLogin);

    await wrapper.find('input[type="email"]').setValue('user@example.com');
    await wrapper.find('input[type="password"]').setValue('password123');
    await wrapper.find('form').trigger('submit.prevent');

    expect(authMock.signIn).toHaveBeenCalledWith('user@example.com', 'password123');
    expect(storeMock.setUser).toHaveBeenCalled();
  });

  it('registers then confirms account', async () => {
    const wrapper = mount(UserLogin);

    const registerToggle = wrapper.findAll('button').find((btn) => btn.text().includes('Register'));
    await registerToggle?.trigger('click');

    await wrapper.find('input[type="email"]').setValue('new@example.com');
    await wrapper.find('input[placeholder="Your display name"]').setValue('Newbie');
    await wrapper.find('input[type="password"]').setValue('password123');
    await wrapper.find('form').trigger('submit.prevent');
    expect(authMock.signUp).toHaveBeenCalled();

    await nextTick();
    const codeInput = wrapper.find('input[placeholder="Enter code from email"]');
    await codeInput.setValue('123456');
    await wrapper.find('form').trigger('submit.prevent');
    expect(authMock.confirmSignUp).toHaveBeenCalledWith('new@example.com', '123456');
  });

  it('renders confirm view after registration', async () => {
    const wrapper = mount(UserLogin);
    const registerToggle = wrapper.findAll('button').find((btn) => btn.text().includes('Register'));
    await registerToggle?.trigger('click');
    await wrapper.find('form').trigger('submit.prevent');
    await nextTick();

    expect(wrapper.text()).toContain('Confirm Email');
    expect(wrapper.find('input[placeholder="Enter code from email"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Confirm');
  });

  it('shows error block and disables submit when loading', async () => {
    authMock.error.value = 'Boom';
    authMock.isLoading.value = true;
    const wrapper = mount(UserLogin);

    expect(wrapper.text()).toContain('Boom');
    const submit = wrapper.get('button[type="submit"]');
    expect(submit.attributes('disabled')).toBeDefined();
  });

  it('switches from register back to login', async () => {
    const wrapper = mount(UserLogin);
    const registerToggle = wrapper.findAll('button').find((btn) => btn.text().includes('Register'));
    await registerToggle?.trigger('click');

    const backToLogin = wrapper.findAll('button').find((btn) => btn.text().includes('Already have an account?'));
    await backToLogin?.trigger('click');

    expect(wrapper.text()).toContain('Sign In');
  });

  it('shows errors from auth composable', async () => {
    authMock.error.value = 'Boom';
    const wrapper = mount(UserLogin);

    expect(wrapper.text()).toContain('Boom');
  });

  it('logs auth errors when actions throw', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    authMock.signIn.mockRejectedValueOnce(new Error('fail'));
    const wrapper = mount(UserLogin);

    await wrapper.find('input[type="email"]').setValue('user@example.com');
    await wrapper.find('input[type="password"]').setValue('password123');
    await wrapper.find('form').trigger('submit.prevent');

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs an error for unsupported modes', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrapper = mount(UserLogin);

    const exposed = wrapper.vm as any;
    exposed.mode = 'weird';
    expect(exposed.mode).toBe('weird');

    await wrapper.find('input[type="email"]').setValue('odd@example.com');
    await wrapper.find('input[type="password"]').setValue('password123');

    await exposed.handleSubmit();

    expect(errorSpy).toHaveBeenCalledWith('Auth error:', expect.any(Error));
    expect((errorSpy.mock.calls[0][1] as Error).message).toContain('Unsupported mode');
    expect(exposed.mode).toBe('login');
    errorSpy.mockRestore();
  });

  it('allows navigating back to sign in from confirm mode', async () => {
    const wrapper = mount(UserLogin);

    const registerToggle = wrapper.findAll('button').find((btn) => btn.text().includes('Register'));
    await registerToggle?.trigger('click');
    await wrapper.find('form').trigger('submit.prevent');
    await nextTick();
    const backButton = wrapper.findAll('button').find((btn) => btn.text().includes('Back to Sign In'));
    await backButton?.trigger('click');

    expect(wrapper.text()).toContain('Sign In');
  });

  it('renders correct header and button text for all modes and loading', async () => {
    const wrapper = mount(UserLogin);

    // login state
    expect(wrapper.text()).toContain('Sign In');
    expect(wrapper.get('button[type="submit"]').text()).toContain('Sign In');

    // register state
    await wrapper.findAll('button').find((btn) => btn.text().includes('Register'))?.trigger('click');
    expect(wrapper.text()).toContain('Create Account');
    expect(wrapper.get('button[type="submit"]').text()).toContain('Create Account');

    // confirm state
    await wrapper.find('form').trigger('submit.prevent');
    await nextTick();
    expect(wrapper.text()).toContain('Confirm Email');
    expect(wrapper.get('button[type="submit"]').text()).toContain('Confirm');

    // loading branch
    authMock.isLoading.value = true;
    await nextTick();
    expect(wrapper.get('button[type="submit"]').text()).toContain('Loading...');
  });

  it('renders confirm mode branches explicitly', async () => {
    const wrapper = mount(UserLogin, { props: { initialMode: 'confirm' } });
    await nextTick();

    expect(wrapper.text()).toContain('Confirm Email');
    expect(wrapper.find('input[placeholder="your@email.com"]').exists()).toBe(false);
    expect(wrapper.find('input[placeholder="Min. 8 characters"]').exists()).toBe(false);
    expect(wrapper.find('input[placeholder="Enter code from email"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Back to Sign In');
  });

  it('submits confirm mode and resets to login', async () => {
    const wrapper = mount(UserLogin, { props: { initialMode: 'confirm' } });
    await nextTick();

    await wrapper.find('input[placeholder="Enter code from email"]').setValue('999999');
    await wrapper.find('form').trigger('submit.prevent');
    await nextTick();

    expect(authMock.confirmSignUp).toHaveBeenCalledWith('', '999999');
    expect((wrapper.vm as any).mode).toBe('login');
  });

  it('renders register mode on initial load', async () => {
    const wrapper = mount(UserLogin, { props: { initialMode: 'register' } });
    await nextTick();

    expect(wrapper.text()).toContain('Create Account');
    expect(wrapper.find('input[placeholder="Your display name"]').exists()).toBe(true);
    expect(wrapper.get('button[type="submit"]').text()).toContain('Create Account');
    expect(wrapper.text()).toContain('Already have an account?');
  });
});

describe('App shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.isAuthenticated.value = false;
    authMock.username.value = 'Tester';
  });

  it('shows loading then login when not authenticated', async () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          UserLogin: { template: '<div data-test="login"></div>' },
          ChatRoom: { template: '<div data-test="chat"></div>' },
        },
      },
    });

    expect(wrapper.text()).toContain('Loading');
    await flushPromises();
    await nextTick();
    expect(authMock.checkSession).toHaveBeenCalled();
    expect(wrapper.html()).toContain('data-test="login"');
  });

  it('renders chat view and supports logout when authenticated', async () => {
    authMock.isAuthenticated.value = true;
    const wrapper = mount(App, {
      global: {
        stubs: {
          UserLogin: { template: '<div data-test="login"></div>' },
          ChatRoom: { template: '<div data-test="chat"></div>' },
        },
      },
    });

    await flushPromises();
    await nextTick();

    expect(wrapper.html()).toContain('data-test="chat"');
    await wrapper.get('button').trigger('click');
    expect(authMock.signOut).toHaveBeenCalled();
    expect(storeMock.clearUser).toHaveBeenCalled();
  });
});
