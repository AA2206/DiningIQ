// app/register.tsx
import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import AuthForm, { AuthFormRef } from '../components/AuthForm';
import { api } from '../lib/api';

// Configure Google Sign-In
GoogleSignin.configure({
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});

export default function Register() {
  const router = useRouter();
  const errorRef = useRef<AuthFormRef>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);

  const handleSubmit = async (username: string, password: string) => {
    try {
      const response = await api.register(username, password);

      const data = await response.json();

      if (response.ok) {
        // Store token if provided
        if (data.token) {
          await AsyncStorage.setItem('token', data.token);
        }
        // Navigate to onboarding
        router.push("/onboarding/gender");
      } else {
        errorRef.current?.setError(data.error || "Registration failed");
      }
    } catch (err) {
        console.log(err); 
        errorRef.current?.setError("Network error. Please try again.");
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      
      // Check if Google Play Services are available (Android)
      await GoogleSignin.hasPlayServices();
      
      // Perform Google Sign-In
      const signInResult = await GoogleSignin.signIn();
      
      const idToken = signInResult.data?.idToken || (signInResult as any).idToken;
      if (!idToken) {
        throw new Error('No ID token received from Google');
      }

      const response = await api.googleAuth(idToken);

      const data = await response.json();

      if (!response.ok) {
        errorRef.current?.setError(data.error || 'Google sign-in failed');
        return;
      }

      // Store our backend JWT token
      if (data.token) {
        await AsyncStorage.setItem('token', data.token);
      }

      // Navigate based on whether user is new or returning
      if (data.isNewUser) {
        router.push("/onboarding/gender");
      } else {
        router.replace("/account" as any);
      }
    } catch (error: any) {
      console.log('Google Sign-In Error:', error);
      
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled the sign-in flow - no error message needed
      } else if (error.code === statusCodes.IN_PROGRESS) {
        errorRef.current?.setError('Sign-in is already in progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        errorRef.current?.setError('Google Play Services not available');
      } else {
        errorRef.current?.setError(error.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setIsAppleLoading(true);
      
      // Check if Apple Sign-In is available (iOS 13+)
      if (!AppleAuthentication.isAvailableAsync()) {
        errorRef.current?.setError('Apple Sign-In is not available on this device');
        return;
      }

      // Perform Apple Sign-In
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      console.log('Apple Sign-In Result:', JSON.stringify(credential, null, 2));

      // Always use Apple user ID as the primary identifier
      // credential.user is consistent across sign-ins, even with "Hide My Email"
      const appleId = credential.user;
      const email = credential.email; // May be null on subsequent sign-ins, that's okay
      const name = credential.fullName 
        ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
        : null;

      // Send Apple user info to backend
      const response = await api.appleAuth(appleId, email, name, credential.identityToken);

      const data = await response.json();

      if (!response.ok) {
        errorRef.current?.setError(data.error || 'Apple sign-in failed');
        return;
      }

      // Store backend JWT token
      if (data.token) {
        await AsyncStorage.setItem('token', data.token);
      }

      // Navigate based on whether user is new or returning
      if (data.isNewUser) {
        router.push("/onboarding/gender");
      } else {
        router.replace("/account" as any);
      }
    } catch (error: any) {
      console.log('Apple Sign-In Error:', error);
      
      if (error.code === 'ERR_CANCELED') {
        // User cancelled - no error message needed
      } else {
        errorRef.current?.setError(error.message || 'Apple sign-in failed. Please try again.');
      }
    } finally {
      setIsAppleLoading(false);
    }
  };

  return (
    <AuthForm
      ref={errorRef}
      title="Register"
      handleSubmit={handleSubmit}
      onGoogleSignIn={handleGoogleSignIn}
      onAppleSignIn={Platform.OS === 'ios' ? handleAppleSignIn : undefined}
      isGoogleLoading={isGoogleLoading}
      isAppleLoading={isAppleLoading}
    />
  );
}
