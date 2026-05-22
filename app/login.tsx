import { useRef } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthForm, { AuthFormRef } from '../components/AuthForm';
import { api } from '../lib/api';
import { useOAuthSignIn } from '../lib/useOAuthSignIn';

export default function Login() {
  const router = useRouter();
  const errorRef = useRef<AuthFormRef>(null);
  const { handleGoogleSignIn, handleAppleSignIn, isGoogleLoading, isAppleLoading } = useOAuthSignIn(errorRef);

  const handleSubmit = async (username: string, password: string) => {
    try {
      const response = await api.login(username, password);
      const data = await response.json();

      if (response.ok) {
        if (data.token) {
          await AsyncStorage.setItem('token', data.token);
        }
        router.replace('/account' as any);
      } else {
        errorRef.current?.setError(data.error || 'Invalid credentials');
      }
    } catch {
      errorRef.current?.setError('Network error. Please try again.');
    }
  };

  return (
    <AuthForm
      ref={errorRef}
      title="Login"
      handleSubmit={handleSubmit}
      onGoogleSignIn={handleGoogleSignIn}
      onAppleSignIn={handleAppleSignIn}
      isGoogleLoading={isGoogleLoading}
      isAppleLoading={isAppleLoading}
    />
  );
}
