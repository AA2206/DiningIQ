// app/register.tsx
import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import AuthForm, { AuthFormRef } from '../components/AuthForm';

// Configure Google Sign-In
GoogleSignin.configure({
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});

export default function Register() {
  const router = useRouter();
  const errorRef = useRef<AuthFormRef>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleSubmit = async (username: string, password: string) => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

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
      
      console.log('Google Sign-In Result:', JSON.stringify(signInResult, null, 2));
      
      // Try both possible structures for the user data
      const user = signInResult.data?.user || (signInResult as any).user;
      
      if (!user?.email) {
        console.log('User object:', user);
        throw new Error('No email received from Google');
      }

      // Send Google user info to our backend
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
      
      const response = await fetch(`${API_BASE_URL}/google-auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
          name: user.name,
          googleId: user.id,
        }),
      });

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

  return (
    <AuthForm
      ref={errorRef}
      title="Register"
      handleSubmit={handleSubmit}
      onGoogleSignIn={handleGoogleSignIn}
      isGoogleLoading={isGoogleLoading}
    />
  );
}
