import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../src/composables/useAuth';

const mockState: any = {};

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
      return {
        getJwtToken: () => 'jwt-token',
      };
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
      mockState.signedOut = true;
    }

    confirmRegistration(_code: string, _forceAlias: boolean, callback: (err: Error | null) => void) {
      if (mockState.confirmError) {
        callback(mockState.confirmError);
        return;
      }
      callback(null);
    }

    authenticateUser(_details: any, callbacks: any) {
      if (mockState.authError) {
        callbacks.onFailure(mockState.authError);
        return;
      }
      const session = new MockCognitoUserSession(mockState.sessionValid);
      mockState.lastSession = session;
      callbacks.onSuccess(session);
    }

    getSession(callback: (err: Error | null, session: MockCognitoUserSession | null) => void) {
      if (!mockState.sessionValid) {
        callback(new Error('invalid'), null);
        return;
      }
      const session = new MockCognitoUserSession(true);
      mockState.lastSession = session;
      callback(null, session);
    }
  }

  class MockCognitoUserPool {
    options: any;
    constructor(options: any) {
      this.options = options;
    }

    signUp(username: string, _password: string, _attributes: any[], _params: any[], callback: any) {
      setTimeout(() => {
        if (mockState.signUpNoResult) {
          callback(null, null);
          return;
        }
        if (mockState.signUpError) {
          callback(mockState.signUpError, null);
          return;
        }
        const user = new MockCognitoUser({ Username: username, Pool: this });
        mockState.currentUser = user;
        callback(null, { user });
      }, 0);
    }

    getCurrentUser() {
      return mockState.shouldReturnUser ? mockState.currentUser : null;
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

beforeEach(() => {
  Object.assign(mockState, {
    signUpError: null,
    confirmError: null,
    authError: null,
    sessionValid: true,
    shouldReturnUser: false,
    signUpNoResult: false,
    currentUser: null,
    signedOut: false,
    lastSession: null,
  });

  const { currentUser, session, error, isLoading, signOut } = useAuth();
  currentUser.value = null;
  session.value = null;
  error.value = null;
  isLoading.value = false;
  signOut();
});

describe('useAuth composable', () => {
  it('signs up a user and stores the current user', async () => {
    const { signUp, currentUser, error, isLoading } = useAuth();

    const promise = signUp('test@example.com', 'password123', 'Tester');

    await promise;

    expect(currentUser.value?.getUsername()).toBe('test@example.com');
    expect(error.value).toBeNull();
    expect(isLoading.value).toBe(false);
  });

  it('handles sign up errors', async () => {
    mockState.signUpError = new Error('signup failed');
    const { signUp, error } = useAuth();

    await expect(signUp('fail@example.com', 'pass', 'User')).rejects.toThrow('signup failed');
    expect(error.value).toBe('signup failed');
  });

  it('handles sign up without result object', async () => {
    mockState.signUpNoResult = true;
    const { signUp, currentUser, error } = useAuth();

    await expect(signUp('noresult@example.com', 'password123', 'Tester')).rejects.toThrow('Signup failed');

    expect(currentUser.value).toBeNull();
    expect(error.value).toBe('Signup failed');
  });

  it('confirms sign up and reports errors', async () => {
    const { confirmSignUp, error } = useAuth();

    await confirmSignUp('user@example.com', '123456');
    expect(error.value).toBeNull();

    mockState.confirmError = new Error('bad code');
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
    mockState.authError = new Error('invalid credentials');
    const { signIn, error, isAuthenticated, session } = useAuth();

    await expect(signIn('login@example.com', 'bad')).rejects.toThrow('invalid credentials');
    expect(error.value).toBe('invalid credentials');
    session.value = null;
    expect(isAuthenticated.value).toBe(false);
  });

  it('checks existing session and signs out', async () => {
    mockState.shouldReturnUser = true;
    mockState.currentUser = {
      getUsername: () => 'existing@example.com',
      getSession: (cb: any) => cb(null, { isValid: () => true, getIdToken: () => ({ getJwtToken: () => 'jwt' }) }),
      signOut: () => {
        mockState.signedOut = true;
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
    expect(mockState.signedOut).toBe(true);
  });

  it('ignores invalid session during checkSession', async () => {
    mockState.shouldReturnUser = true;
    mockState.sessionValid = false;
    mockState.currentUser = {
      getUsername: () => 'bad@example.com',
      getSession: (cb: any) => cb(new Error('invalid'), null),
      signOut: () => {},
    };

    const { checkSession, currentUser, session, isAuthenticated } = useAuth();
    await checkSession();

    expect(currentUser.value).toBeNull();
    expect(session.value).toBeNull();
    expect(isAuthenticated.value).toBe(false);
  });

  it('returns early when no current user is stored', async () => {
    mockState.shouldReturnUser = false;
    const { checkSession, currentUser, session, isAuthenticated } = useAuth();

    await checkSession();

    expect(currentUser.value).toBeNull();
    expect(session.value).toBeNull();
    expect(isAuthenticated.value).toBe(false);
  });

  it('exposes username/id token helpers when no session/user present', () => {
    const { username, isAuthenticated, getIdToken, signOut } = useAuth();

    signOut();

    expect(username.value).toBeNull();
    expect(isAuthenticated.value).toBe(false);
    expect(getIdToken()).toBeNull();
  });
});
