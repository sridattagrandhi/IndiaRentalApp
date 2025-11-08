// app/services/auth.ts
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';

// Read from EXPO_PUBLIC_* env (or swap to your constants file if you prefer)
const USER_POOL_ID = process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID!;
const CLIENT_ID    = process.env.EXPO_PUBLIC_COGNITO_APP_CLIENT_ID!;

if (!USER_POOL_ID || !CLIENT_ID) {
  throw new Error(
    `[Cognito config] Missing envs: USER_POOL_ID="${USER_POOL_ID}", CLIENT_ID="${CLIENT_ID}".`
  );
}

const pool = new CognitoUserPool({ UserPoolId: USER_POOL_ID, ClientId: CLIENT_ID });

/** ---------- Helpers ---------- **/

function getCognitoUser(username: string) {
  return new CognitoUser({ Username: username, Pool: pool });
}

function ensureSession(user: CognitoUser): Promise<CognitoUserSession> {
  return new Promise((resolve, reject) => {
    user.getSession((err: Error | null, session: CognitoUserSession) => 
      (err ? reject(err) : resolve(session)));
  });
}

/** ---------- Public API (names your screens already use) ---------- **/

// SIGN UP (email + password)
export async function signUpEmail(params: { username: string; password: string; email: string }) {
  const { username, password, email } = params;
  const attrs = [new CognitoUserAttribute({ Name: 'email', Value: email })];

  return new Promise<'OK'>((resolve, reject) => {
    pool.signUp(username, password, attrs, [], (err, result) => {
      if (err || !result) return reject(err ?? new Error('No result from signUp'));
      resolve('OK');
    });
  });
}

// CONFIRM EMAIL OTP
export async function confirmSignUp(params: { username: string; code: string }) {
  const user = getCognitoUser(params.username);
  return new Promise<'OK'>((resolve, reject) => {
    user.confirmRegistration(params.code, true, (err) => (err ? reject(err) : resolve('OK')));
  });
}

// SIGN IN (used by LoginPage)
export async function signIn(params: { username: string; password: string }) {
  const user = getCognitoUser(params.username);
  const auth = new AuthenticationDetails({ Username: params.username, Password: params.password });

  return new Promise<{ idToken: string; accessToken: string; refreshToken: string }>((resolve, reject) => {
    user.authenticateUser(auth, {
      onSuccess: (session) =>
        resolve({
          idToken: session.getIdToken().getJwtToken(),
          accessToken: session.getAccessToken().getJwtToken(),
          refreshToken: session.getRefreshToken().getToken(),
        }),
      onFailure: reject,
      newPasswordRequired: () => reject(new Error('NewPasswordRequired')),
    });
  });
}

// SIGN IN after email confirm (used by OTPVerification)
export async function signInEmail(params: { usernameOrEmail: string; password: string }) {
  // If you use email-as-username in Cognito, usernameOrEmail works as the Username
  const r = await signIn({ username: params.usernameOrEmail, password: params.password });
  return {
    idToken: r.idToken,
    accessToken: r.accessToken,
    refreshToken: r.refreshToken,
    // Optional parity fields for your current code
    expiresIn: undefined,
    tokenType: 'Bearer',
  };
}

// UPDATE ATTRIBUTES (NO ACCESS TOKEN NEEDED) — uses SRP session
export async function updateAttributes(username: string, attributes: Record<string, string>) {
  const user = getCognitoUser(username);
  await ensureSession(user); // ensure we’re authenticated

  const attrs = Object.entries(attributes).map(
    ([Name, Value]) => new CognitoUserAttribute({ Name, Value })
  );

  return new Promise<'OK'>((resolve, reject) => {
    user.updateAttributes(attrs, (err) => (err ? reject(err) : resolve('OK')));
  });
}

// Send OTP to phone (optional; uses current SRP user session)
export async function sendPhoneVerifyCode(username: string) {
  const user = getCognitoUser(username);
  await ensureSession(user);
  return new Promise<'OK'>((resolve, reject) => {
    user.getAttributeVerificationCode('phone_number', {
      onSuccess: () => resolve('OK'),
      onFailure: reject,
      inputVerificationCode: () => resolve('OK'),
    });
  });
}

// Confirm phone OTP (optional)
export async function submitPhoneVerifyCode(username: string, code: string) {
  const user = getCognitoUser(username);
  await ensureSession(user);
  return new Promise<'OK'>((resolve, reject) => {
    user.verifyAttribute('phone_number', code, {
      onSuccess: () => resolve('OK'),
      onFailure: reject,
    });
  });
}

// Resend email code
export async function resendSignUpCode(username: string) {
  const user = getCognitoUser(username);
  return new Promise<'OK'>((resolve, reject) => {
    user.resendConfirmationCode((err) => (err ? reject(err) : resolve('OK')));
  });
}

// Resend phone code (same as send)
export function resendPhoneVerifyCode(username: string) {
  return sendPhoneVerifyCode(username);
}
