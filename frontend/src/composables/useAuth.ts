import { ref, computed } from 'vue';
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';

type RuntimeEnv = {
  VITE_COGNITO_USER_POOL_ID?: string;
  VITE_COGNITO_CLIENT_ID?: string;
  VITE_MOCK_AUTH?: string;
  TEST_FORCE_COGNITO?: string;
};

function getStringEnv(
  obj: Record<string, unknown>,
  key: keyof RuntimeEnv
): string | undefined {
  const v = obj[key as string];
  return typeof v === 'string' ? v : undefined;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    return typeof msg === 'string' ? msg : 'Authentication failed';
  }
  return 'Authentication failed';
}

const isValidUserPoolId = (value?: string) =>
  !!value && /^[\w-]+_[0-9A-Za-z]+$/.test(value);

const isValidClientId = (value?: string) => !!value && value.length >= 10;

const getEnv = (): RuntimeEnv => {
  // Prefer Vite env, but allow tests to inject via a process env shim.
  const procEnv = (globalThis as unknown as { process?: { env?: Record<string, unknown> } })
    .process?.env;
  const merged: Record<string, unknown> = { ...(procEnv || {}), ...import.meta.env };

  return {
    VITE_COGNITO_USER_POOL_ID: getStringEnv(merged, 'VITE_COGNITO_USER_POOL_ID'),
    VITE_COGNITO_CLIENT_ID: getStringEnv(merged, 'VITE_COGNITO_CLIENT_ID'),
    VITE_MOCK_AUTH: getStringEnv(merged, 'VITE_MOCK_AUTH'),
    TEST_FORCE_COGNITO: getStringEnv(merged, 'TEST_FORCE_COGNITO'),
  };
};

const currentUser = ref<CognitoUser | null>(null);
const session = ref<CognitoUserSession | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);
const mockUser = ref<{ email: string; nickname: string } | null>(null);
const mockSession = ref(false);

export function useAuth() {
  const env = getEnv();
  const userPoolId = env.VITE_COGNITO_USER_POOL_ID as string | undefined;
  const clientId = env.VITE_COGNITO_CLIENT_ID as string | undefined;
  const mockAuth = env.VITE_MOCK_AUTH === 'true';
  const forceCognito = env.TEST_FORCE_COGNITO === 'true';

  const shouldUseMockAuth =
    !forceCognito &&
    (mockAuth || !isValidUserPoolId(userPoolId) || !isValidClientId(clientId));

  const userPool = shouldUseMockAuth
    ? null
    : new CognitoUserPool({
        UserPoolId: userPoolId as string,
        ClientId: clientId as string,
      });

  if (shouldUseMockAuth) {
    const isAuthenticated = computed(() => mockSession.value);
    const username = computed(() => mockUser.value?.nickname || null);

    async function signUp(email: string, _password: string, nickname: string): Promise<void> {
      isLoading.value = true;
      error.value = null;
      mockUser.value = { email, nickname };
      isLoading.value = false;
    }

    async function confirmSignUp(): Promise<void> {
      isLoading.value = true;
      error.value = null;
      isLoading.value = false;
    }

    async function signIn(email: string, _password: string): Promise<void> {
      isLoading.value = true;
      error.value = null;
      const nickname = email.split('@')[0];
      mockUser.value = { email, nickname };
      mockSession.value = true;
      isLoading.value = false;
    }

    function signOut(): void {
      mockUser.value = null;
      mockSession.value = false;
    }

    function getIdToken(): string | null {
      return mockSession.value ? 'mock-token' : null;
    }

    function checkSession(): Promise<void> {
      return Promise.resolve();
    }

    return {
      currentUser,
      session,
      isLoading,
      error,
      isAuthenticated,
      username,
      signUp,
      confirmSignUp,
      signIn,
      signOut,
      getIdToken,
      checkSession,
    };
  }

  const isAuthenticated = computed(() => !!session.value?.isValid());
  const username = computed(() => currentUser.value?.getUsername() || null);

  async function signUp(
    email: string,
    password: string,
    nickname: string
  ): Promise<void> {
    isLoading.value = true;
    error.value = null;

    return new Promise((resolve, reject) => {
      const attributes = [
        new CognitoUserAttribute({ Name: 'email', Value: email }),
        new CognitoUserAttribute({ Name: 'nickname', Value: nickname }),
      ];

      userPool?.signUp(email, password, attributes, [], (err, result) => {
        isLoading.value = false;
        if (err) {
          error.value = err.message;
          reject(err);
          return;
        }
        if (result) {
          currentUser.value = result.user;
          resolve();
          return;
        }

        error.value = 'Signup failed';
        reject(new Error('Signup failed'));
      });
    });
  }

  async function confirmSignUp(email: string, code: string): Promise<void> {
    isLoading.value = true;
    error.value = null;

    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool as CognitoUserPool,
    });

    return new Promise((resolve, reject) => {
      cognitoUser.confirmRegistration(code, true, (err) => {
        isLoading.value = false;
        if (err) {
          error.value = err.message;
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async function signIn(email: string, password: string): Promise<void> {
    isLoading.value = true;
    error.value = null;

    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool as CognitoUserPool,
    });

    const handleSuccess = (userSession: CognitoUserSession) => {
      isLoading.value = false;
      currentUser.value = cognitoUser;
      session.value = userSession;
    };

    const handleFailure = (err: unknown, reject: (reason?: unknown) => void) => {
      isLoading.value = false;
      error.value = getErrorMessage(err);
      reject(err);
    };

    const authDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    return new Promise((resolve, reject) => {
      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (userSession) => {
          handleSuccess(userSession);
          resolve();
        },
        onFailure: (err) => {
          handleFailure(err, reject);
        },
        newPasswordRequired: () => {
          // For temp-password users, complete the challenge by setting the provided password.
          cognitoUser.completeNewPasswordChallenge(
            password,
            {},
            {
              onSuccess: (userSession) => {
                handleSuccess(userSession);
                resolve();
              },
              onFailure: (err) => {
                handleFailure(err, reject);
              },
            }
          );
        },
      });
    });
  }

  function signOut(): void {
    currentUser.value?.signOut();
    currentUser.value = null;
    session.value = null;
  }

  function getIdToken(): string | null {
    return session.value?.getIdToken().getJwtToken() || null;
  }

  function checkSession(): Promise<void> {
    return new Promise((resolve) => {
      const user = userPool?.getCurrentUser();
      if (!user) {
        resolve();
        return;
      }

      user.getSession(
        (err: Error | null, userSession: CognitoUserSession | null) => {
          if (err || !userSession?.isValid()) {
            resolve();
            return;
          }
          currentUser.value = user;
          session.value = userSession;
          resolve();
        }
      );
    });
  }

  return {
    currentUser,
    session,
    isLoading,
    error,
    isAuthenticated,
    username,
    signUp,
    confirmSignUp,
    signIn,
    signOut,
    getIdToken,
    checkSession,
  };
}
