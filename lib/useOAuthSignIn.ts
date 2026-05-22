import { useState } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { api } from './api';
import type { AuthFormRef } from '../components/AuthForm';
import type React from 'react';

export function useOAuthSignIn(errorRef: React.RefObject<AuthFormRef | null>) {
  const router = useRouter();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      await GoogleSignin.hasPlayServices();
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

      if (data.token) {
        await AsyncStorage.setItem('token', data.token);
      }

      if (data.isNewUser) {
        router.push('/onboarding/gender');
      } else {
        router.replace('/account' as any);
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled — no message needed
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

  const handleAppleSignIn = Platform.OS === 'ios'
    ? async () => {
        try {
          setIsAppleLoading(true);

          if (!await AppleAuthentication.isAvailableAsync()) {
            errorRef.current?.setError('Apple Sign-In is not available on this device');
            return;
          }

          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });

          const name = credential.fullName
            ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
            : null;

          const response = await api.appleAuth(
            credential.user,
            credential.email,
            name,
            credential.identityToken,
          );
          const data = await response.json();

          if (!response.ok) {
            errorRef.current?.setError(data.error || 'Apple sign-in failed');
            return;
          }

          if (data.token) {
            await AsyncStorage.setItem('token', data.token);
          }

          if (data.isNewUser) {
            router.push('/onboarding/gender');
          } else {
            router.replace('/account' as any);
          }
        } catch (error: any) {
          if (error.code === 'ERR_CANCELED') {
            // user cancelled — no message needed
          } else {
            errorRef.current?.setError(error.message || 'Apple sign-in failed. Please try again.');
          }
        } finally {
          setIsAppleLoading(false);
        }
      }
    : undefined;

  return { handleGoogleSignIn, handleAppleSignIn, isGoogleLoading, isAppleLoading };
}
