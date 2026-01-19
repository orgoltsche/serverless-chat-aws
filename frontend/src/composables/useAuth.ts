import { ref, computed } from 'vue';
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';

const userPool = new CognitoUserPool({
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID as string,
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID as string,
});

const currentUser = ref<CognitoUser | null>(null);
const session = ref<CognitoUserSession | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);

export function useAuth() {
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

      userPool.signUp(email, password, attributes, [], (err, result) => {
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
      Pool: userPool,
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
      Pool: userPool,
    });

    const authDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    return new Promise((resolve, reject) => {
      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (userSession) => {
          isLoading.value = false;
          currentUser.value = cognitoUser;
          session.value = userSession;
          resolve();
        },
        onFailure: (err) => {
          isLoading.value = false;
          error.value = err.message;
          reject(err);
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
      const user = userPool.getCurrentUser();
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
