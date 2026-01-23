import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { useAuth as UseAuth } from '../../src/composables/useAuth';

const state: any = {};

vi.mock('amazon-cognito-identity-js', () => {
  class MockCognitoUserSession {
    valid: boolean;
    constructor(valid = true) {
      this.valid = valid;
    }
    isValid() {
      return this.valid;
    }
    getIdToken() {
      return { getJwtToken: () => 'jwt-token' };
    }
  }

  class MockCognitoUser {
    username: string;
    pool: any;
    constructor({ Username, Pool }: any) {
      this.username = Username;
      this.pool = Pool;
    }

    getUsername() {
      return this.username;
    }

    signOut() {
      state.signedOut = true;
    }

    confirmRegistration(_code: string, _forceAlias: boolean, cb: (err: Error | null) => void) {
      if (state.confirmError) {
        cb(state.confirmError);
        return;
      }
      cb(null);
    }

    authenticateUser(_details: any, callbacks: any) {
      if (state.authError) {
        callbacks.onFailure(state.authError);
        return;
      }
      const session = new MockCognitoUserSession(state.sessionValid);
      state.lastSession = session;
      callbacks.onSuccess(session);
    }

    getSession(cb: (err: Error | null, session: MockCognitoUserSession | null) => void) {
      if (!state.sessionValid) {
        cb(new Error('invalid'), null);
        return;
      }
      const session = new MockCognitoUserSession(true);
      state.lastSession = session;
      cb(null, session);
    }
  }

  class MockCognitoUserPool {
    signUp(username: string, _password: string, _attrs: any[], _params: any[], cb: any) {
      setTimeout(() => {
        if (state.signUpNoResult) {
          cb(null, null);
          return;
        }
        if (state.signUpError) {
          cb(state.signUpError, null);
          return;
        }
        const user = new MockCognitoUser({ Username: username, Pool: this });
        state.currentUser = user;
        cb(null, { user });
      }, 0);
    }

    getCurrentUser() {
      return state.shouldReturnUser ? state.currentUser : null;
    }
  }

  class MockCognitoUserAttribute {
    constructor(public options: any) {}
  }

  class MockAuthenticationDetails {
    constructor(public options: any) {}
  }

  return {
    CognitoUserPool: MockCognitoUserPool,
    CognitoUser: MockCognitoUser,
    CognitoUserSession: MockCognitoUserSession,
    CognitoUserAttribute: MockCognitoUserAttribute,
    AuthenticationDetails: MockAuthenticationDetails,
  };
});

async function loadUseAuth(): Promise<UseAuth> {
  vi.resetModules();
  vi.stubEnv('VITE_MOCK_AUTH', 'false');
  vi.stubEnv('VITE_COGNITO_USER_POOL_ID', 'eu-central-1_test');
  vi.stubEnv('VITE_COGNITO_CLIENT_ID', 'testclientid');
  vi.stubEnv('TEST_FORCE_COGNITO', 'true');
  process.env.VITE_MOCK_AUTH = 'false';
  process.env.VITE_COGNITO_USER_POOL_ID = 'eu-central-1_test';
  process.env.VITE_COGNITO_CLIENT_ID = 'testclientid';
  process.env.TEST_FORCE_COGNITO = 'true';

  const module = await import('../../src/composables/useAuth');
  return module.useAuth;
}

let useAuth: UseAuth;

beforeEach(async () => {
  Object.assign(state, {
    signUpError: null,
    signUpNoResult: false,
    confirmError: null,
    authError: null,
    sessionValid: true,
    shouldReturnUser: false,
    currentUser: null,
    signedOut: false,
    lastSession: null,
  });

  useAuth = await loadUseAuth();

  const { currentUser, session, isLoading, error, signOut } = useAuth();
  currentUser.value = null;
  session.value = null;
  isLoading.value = false;
  error.value = null;
  signOut();
});

describe('useAuth composable (Cognito branch)', () => {
  it('signs up a user and stores the current user', async () => {
    const { signUp, currentUser, error, isLoading } = useAuth();

    await signUp('test@example.com', 'password123', 'Tester');

    expect(currentUser.value?.getUsername()).toBe('test@example.com');
    expect(error.value).toBeNull();
    expect(isLoading.value).toBe(false);
  });

  it('handles sign up errors', async () => {
    state.signUpError = new Error('signup failed');
    const { signUp, error } = useAuth();

    await expect(signUp('fail@example.com', 'pass', 'User')).rejects.toThrow('signup failed');
    expect(error.value).toBe('signup failed');
  });

  it('handles sign up without result object', async () => {
    state.signUpNoResult = true;
    const { signUp, currentUser, error } = useAuth();

    await expect(signUp('noresult@example.com', 'password123', 'Tester')).rejects.toThrow('Signup failed');
    expect(currentUser.value).toBeNull();
    expect(error.value).toBe('Signup failed');
  });

  it('confirms sign up and reports errors', async () => {
    const { confirmSignUp, error } = useAuth();

    await confirmSignUp('user@example.com', '123456');
    expect(error.value).toBeNull();

    state.confirmError = new Error('bad code');
    await expect(confirmSignUp('user@example.com', 'bad')).rejects.toThrow('bad code');
    expect(error.value).toBe('bad code');
  });

  it('signs in and exposes session/token helpers', async () => {
    const { signIn, session, isAuthenticated, username, getIdToken } = useAuth();

    await signIn('login@example.com', 'pass');

    expect(session.value).toBeTruthy();
    expect(isAuthenticated.value).toBe(true);
    expect(username.value).toBe('login@example.com');
    expect(getIdToken()).toBe('jwt-token');
  });

  it('handles authentication failures', async () => {
    state.authError = new Error('invalid credentials');
    const { signIn, error, isAuthenticated, session } = useAuth();

    await expect(signIn('login@example.com', 'bad')).rejects.toThrow('invalid credentials');
    expect(error.value).toBe('invalid credentials');
    session.value = null;
    expect(isAuthenticated.value).toBe(false);
  });

  it('checks existing session and signs out', async () => {
    state.shouldReturnUser = true;
    state.currentUser = {
      getUsername: () => 'existing@example.com',
      getSession: (cb: any) => cb(null, { isValid: () => true, getIdToken: () => ({ getJwtToken: () => 'jwt' }) }),
      signOut: () => {
        state.signedOut = true;
      },
    };

    const { checkSession, currentUser, isAuthenticated, signOut, session } = useAuth();

    await checkSession();
    expect(currentUser.value?.getUsername()).toBe('existing@example.com');
    expect(isAuthenticated.value).toBe(true);
    expect(session.value).toBeTruthy();

    signOut();
    expect(currentUser.value).toBeNull();
    expect(session.value).toBeNull();
    expect(state.signedOut).toBe(true);
  });
});
