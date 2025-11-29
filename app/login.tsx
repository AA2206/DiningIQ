// app/login.tsx
import { useRef } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthForm, { AuthFormRef } from '../components/AuthForm';

export default function Login() {
  const router = useRouter();
  const errorRef = useRef<AuthFormRef>(null);

  const handleSubmit = async (username: string, password: string) => {
    try {
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
      
      const response = await fetch(`${API_BASE_URL}/login`, {
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
        // Navigate to meal plan page
        router.push("/account" as any);
      } else {
        errorRef.current?.setError(data.error || "Invalid credentials");
      }
    } catch (err) {
      errorRef.current?.setError("Network error. Please try again.");
    }
  };

  return (
    <AuthForm
      ref={errorRef}
      title="Login"
      handleSubmit={handleSubmit}
    />
  );
}