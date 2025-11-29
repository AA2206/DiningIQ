// app/register.tsx
import { useRef } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthForm, { AuthFormRef } from '../components/AuthForm';

export default function Register() {
  const router = useRouter();
  const errorRef = useRef<AuthFormRef>(null);

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
          // TODO: Store token (e.g., using AsyncStorage)
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

  return (
    <AuthForm
      ref={errorRef}
      title="Register"
      handleSubmit={handleSubmit}
    />
  );
}