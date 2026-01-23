import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../src/composables/useAuth';

const withMockEnv = () => {
  vi.stubEnv('VITE_MOCK_AUTH', 'true');
  vi.stubEnv('VITE_COGNITO_USER_POOL_ID', '');
  vi.stubEnv('VITE_COGNITO_CLIENT_ID', '');
  process.env.VITE_MOCK_AUTH = 'true';
  process.env.VITE_COGNITO_USER_POOL_ID = '';
  process.env.VITE_COGNITO_CLIENT_ID = '';
};

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  withMockEnv();

  const { currentUser, session, isLoading, error, signOut } = useAuth();
  currentUser.value = null;
  session.value = null;
  isLoading.value = false;
  error.value = null;
  signOut();
});

describe('useAuth composable (mock auth)', () => {
  it('signs up a user and exposes nickname as username', async () => {
    const { signUp, username, isAuthenticated, error, isLoading } = useAuth();

    await signUp('test@example.com', 'password123', 'Tester');

    expect(username.value).toBe('Tester');
    expect(isAuthenticated.value).toBe(false);
    expect(error.value).toBeNull();
    expect(isLoading.value).toBe(false);
  });

  it('confirms sign up (no-op in mock) and keeps state intact', async () => {
    const { confirmSignUp, username, isAuthenticated } = useAuth();

    await confirmSignUp('user@example.com', '123456');

    expect(username.value).toBeNull();
    expect(isAuthenticated.value).toBe(false);
  });

  it('signs in, sets session flags, and returns mock token', async () => {
    const { signIn, isAuthenticated, username, getIdToken } = useAuth();

    await signIn('login@example.com', 'pass');

    expect(isAuthenticated.value).toBe(true);
    expect(username.value).toBe('login');
    expect(getIdToken()).toBe('mock-token');
  });

  it('signs out and clears session/user state', async () => {
    const { signIn, signOut, isAuthenticated, username, getIdToken } = useAuth();

    await signIn('login@example.com', 'pass');
    signOut();

    expect(isAuthenticated.value).toBe(false);
    expect(username.value).toBeNull();
    expect(getIdToken()).toBeNull();
  });

  it('checkSession resolves and leaves state unchanged in mock mode', async () => {
    const { checkSession, isAuthenticated, username } = useAuth();

    await checkSession();

    expect(isAuthenticated.value).toBe(false);
    expect(username.value).toBeNull();
  });
});
