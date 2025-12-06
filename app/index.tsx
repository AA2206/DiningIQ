// app/index.tsx
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import '../global.css';

// Configure Google Sign-In
GoogleSignin.configure({
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});

export default function Index() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  async function checkAuthStatus() {
    try {
      const token = await AsyncStorage.getItem("token");
      
      if (token) {
        // User has a token, redirect to account
        router.replace("/account" as any);
      } else {
        // No token, show landing page
        setIsCheckingAuth(false);
      }
    } catch (err) {
      console.error("Error checking auth status:", err);
      setIsCheckingAuth(false);
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      setError(null);
      
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
        setError(data.error || 'Google sign-in failed');
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
        setError('Sign-in is already in progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setError('Google Play Services not available');
      } else {
        setError(error.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Show loading spinner while checking auth status
  if (isCheckingAuth) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gradient-to-b from-blue-50 to-white">
      <View className="flex-1 min-h-screen px-6 py-16 justify-center">
        {/* Hero Section */}
        <View className="items-center mb-16">
          <View className="mb-6">
            <Text className="text-6xl font-extrabold text-gray-900 mb-3 text-center leading-tight">
              Eat Healthy,{'\n'}Stay Fit
            </Text>
            <View className="h-1 w-20 bg-blue-600 mx-auto rounded-full" />
          </View>
          
          <Text className="text-xl text-gray-600 text-center mb-1 px-4 leading-relaxed max-w-md">
            Get personalized daily meal plans and keep track of macros to achieve your goals
          </Text>
        </View>

        {/* Features Cards */}
        <View className="w-full mb-12 gap-4 ">
          <View className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100">
            <View className="flex-row items-center gap-4">
              <View className="w-12 h-12 bg-blue-100 rounded-xl items-center justify-center">
                <Text className="text-2xl">🍎</Text>
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold text-gray-900 mb-1">
                  AI-Powered Recommendations
                </Text>
                <Text className="text-sm text-gray-500">
                  Smart meal planning tailored to your preferences
                </Text>
              </View>
            </View>
          </View>

          <View className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100">
            <View className="flex-row items-center gap-4">
              <View className="w-12 h-12 bg-blue-100 rounded-xl items-center justify-center">
                <Text className="text-2xl">📊</Text>
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold text-gray-900 mb-1">
                  Track Your Progress
                </Text>
                <Text className="text-sm text-gray-500">
                  Monitor macros and nutrition goals effortlessly
                </Text>
              </View>
            </View>
          </View>

          <View className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100">
            <View className="flex-row items-center gap-4">
              <View className="w-12 h-12 bg-blue-100 rounded-xl items-center justify-center">
                <Text className="text-2xl">✨</Text>
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold text-gray-900 mb-1">
                  Personalized Plans
                </Text>
                <Text className="text-sm text-gray-500">
                  Customized for your dietary needs and goals
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Error Message */}
        {error && (
          <View className="w-full mb-4 bg-red-50 border border-red-200 rounded-xl p-4">
            <Text className="text-red-600 text-center">{error}</Text>
          </View>
        )}

        {/* Google Sign-In Button */}
        <View className="w-full">
          <TouchableOpacity 
            className="w-full bg-blue-600 py-5 px-6 rounded-2xl flex-row items-center justify-center shadow-lg shadow-blue-600/30"
            onPress={handleGoogleSignIn}
            disabled={isGoogleLoading}
            activeOpacity={0.8}
          >
            {isGoogleLoading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <View className="w-8 h-8 mr-3 items-center justify-center bg-white rounded-full">
                  <Text className="text-lg font-bold" style={{ color: '#4285F4' }}>G</Text>
                </View>
                <Text className="text-white text-xl font-semibold">
                  Continue with Google
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer Text */}
        <View className="mt-8 items-center">
          <Text className="text-sm text-gray-400 text-center">
            Join thousands of users achieving their health goals
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
