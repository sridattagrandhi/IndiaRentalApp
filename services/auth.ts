// app/services/auth.ts
import { apiGet } from '@/services/api';
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import * as SecureStore from 'expo-secure-store';

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

/** 
 * Helper to decode base64url (React Native compatible)
 */
function base64UrlDecode(str: string): string {
  // Convert base64url to base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  
  // Add padding if needed
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  
  // Decode base64 to string (React Native compatible)
  try {
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch (error) {
    throw new Error('Failed to decode base64url');
  }
}

/** 
 * Helper to decode JWT and extract user_id (sub claim)
 * This ensures we're using the same user_id that the backend sees
 */
function extractUserIdFromToken(idToken: string): string | null {
  try {
    // JWT format: header.payload.signature
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      console.error('Invalid JWT format');
      return null;
    }
    
    // Decode the payload (base64url)
    const payload = parts[1];
    const decodedPayload = base64UrlDecode(payload);
    const decoded = JSON.parse(decodedPayload);
    
    // Return 'sub' claim (Cognito user UUID)
    const userId = decoded.sub || decoded['cognito:username'] || decoded.email || null;
    
    if (userId) {
      console.log('✅ Extracted user_id from token:', userId);
    } else {
      console.warn('⚠️ No user_id found in token claims:', Object.keys(decoded));
    }
    
    return userId;
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
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
      onSuccess: async (session) => {
        const idToken = session.getIdToken().getJwtToken();
        const accessToken = session.getAccessToken().getJwtToken();
        const refreshToken = session.getRefreshToken().getToken();

        try {
          const profile = await apiGet<{ user_id: string; avatar_url?: string | null }>(
            '/v1/profile',
            { headers: { Authorization: `Bearer ${idToken}` } }
          );

          if (profile?.user_id) {
            await SecureStore.setItemAsync('backend_user_id', profile.user_id);
            console.log('✅ Stored backend_user_id:', profile.user_id);
          } else {
            console.warn('⚠️ /v1/profile returned no user_id');
          }

          if (profile?.avatar_url) {
            await SecureStore.setItemAsync('my_avatar_url', profile.avatar_url);
          }
        } catch (e) {
          console.warn('⚠️ Failed to fetch /v1/profile after login:', e);
        }
        
        // ✅ CRITICAL: Extract and store user_id from the idToken
        const userId = extractUserIdFromToken(idToken);
        
        if (userId) {
          try {
            await SecureStore.setItemAsync('user_id', userId);
            console.log('✅ Stored user_id:', userId);
          } catch (error) {
            console.error('⚠️ Failed to store user_id:', error);
          }
        } else {
          console.warn('⚠️ Could not extract user_id from token');
        }
        await SecureStore.setItemAsync('idToken', idToken);
        await SecureStore.setItemAsync('accessToken', accessToken);
        await SecureStore.setItemAsync('refreshToken', refreshToken);
        
        resolve({
          idToken,
          accessToken,
          refreshToken,
        });
      },
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

// SIGN OUT
export async function signOut() {
  const user = pool.getCurrentUser();
  if (user) {
    user.signOut();
  }
  
  // Clear stored user_id
  try {
    await SecureStore.deleteItemAsync('user_id');
    console.log('✅ Cleared user_id from storage');
  } catch (error) {
    console.error('⚠️ Failed to clear user_id:', error);
  }
}

// GET CURRENT USER ID
export async function getCurrentUserId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync('user_id');
  } catch (error) {
    console.error('Failed to get user_id:', error);
    return null;
  }
}

// UPDATE ATTRIBUTES (NO ACCESS TOKEN NEEDED) – uses SRP session
export async function updateAttributes(username: string, attributes: Record<string, string>) {
  const user = getCognitoUser(username);
  await ensureSession(user); // ensure we're authenticated

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