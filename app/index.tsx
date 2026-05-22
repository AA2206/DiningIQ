// app/index.tsx
import { View, Text, ScrollView, ActivityIndicator, Platform, Linking, Image } from "react-native";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import '../global.css';
import { api } from '../lib/api';

// Configure Google Sign-In (webClientId is required on Android)
GoogleSignin.configure({
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

export default function Index() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Helper function to check if onboarding is complete
  async function checkOnboardingComplete(): Promise<boolean> {
    try {
      const response = await api.getUserProfile();

      if (response.ok) {
        const profile = await response.json();

        // Check if all required onboarding fields are present
        const isOnboardingComplete =
          profile.gender !== null &&
          profile.frequency !== null &&
          profile.height !== null &&
          profile.weight !== null &&
          profile.age !== null &&
          profile.goal !== null &&
          profile.diet !== null &&
          profile.other !== null; // other can be empty string, but must not be null

        return isOnboardingComplete;
      }
      return false;
    } catch (err) {
      console.error("Error checking onboarding status:", err);
      return false;
    }
  }

  async function checkAuthStatus() {
    try {
      const token = await AsyncStorage.getItem("token");
      
      if (token) {
        // First, check if meal plan generation is in progress
        try {
          const statusResponse = await api.getGenerationStatus();

          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            
            // If generation is in progress, redirect to loading page
            if (statusData.inProgress) {
              router.replace("/loading" as any);
              return;
            }
          }
        } catch (statusErr) {
          console.error("Error checking generation status:", statusErr);
          // Continue with other checks if generation status check fails
        }

        // Check if onboarding is complete by verifying required fields
        try {
          const response = await api.getUserProfile();

          if (response.ok) {
            const profile = await response.json();
            
            // Check if all required onboarding fields are present
            const isOnboardingComplete = 
              profile.gender !== null &&
              profile.frequency !== null &&
              profile.height !== null &&
              profile.weight !== null &&
              profile.age !== null &&
              profile.goal !== null &&
              profile.diet !== null &&
              profile.other !== null; // other can be empty string, but must not be null

            if (isOnboardingComplete) {
              // Onboarding complete, redirect to account
              router.replace("/account" as any);
            } else {
              // Onboarding incomplete, redirect to start of onboarding
              router.replace("/onboarding/gender" as any);
            }
          } else if (response.status === 401 || response.status === 403) {
            await AsyncStorage.removeItem("token");
            await AsyncStorage.removeItem("supabase_session");
            setIsCheckingAuth(false);
          } else {
            // Other error, still try to redirect to onboarding
            router.replace("/onboarding/gender" as any);
          }
        } catch (err) {
          console.error("Error checking profile:", err);
          // On error, redirect to onboarding to be safe
          router.replace("/onboarding/gender" as any);
        }
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

      if (Platform.OS === 'android' && !process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
        setError('Google Sign-In is not configured for Android (missing web client ID).');
        return;
      }

      // Check if Google Play Services are available (Android)
      await GoogleSignin.hasPlayServices();

      const signInResult = await GoogleSignin.signIn();

      const idToken = signInResult.data?.idToken || (signInResult as any).idToken;
      if (!idToken) {
        throw new Error('No ID token received from Google');
      }

      const response = await api.googleAuth(idToken);

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Google sign-in failed');
        return;
      }

      // Store our backend JWT token
      if (data.token) {
        await AsyncStorage.setItem('token', data.token);
      }

      // Check if meal plan generation is in progress
      try {
        const statusResponse = await api.getGenerationStatus();

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();

          // If generation is in progress, redirect to loading page
          if (statusData.inProgress) {
            router.replace("/loading" as any);
            return;
          }
        }
      } catch (statusErr) {
        console.error("Error checking generation status:", statusErr);
        // Continue with normal flow if generation status check fails
      }

      // Navigate based on whether user is new or returning
      if (data.isNewUser) {
        // New user always goes to onboarding
        router.push("/onboarding/gender");
      } else {
        // Returning user: check if onboarding is complete
        const isOnboardingComplete = await checkOnboardingComplete();
        if (isOnboardingComplete) {
          router.replace("/account" as any);
        } else {
          router.replace("/onboarding/gender" as any);
        }
      }
    } catch (error: any) {
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

  const handleAppleSignIn = async () => {
    try {
      setIsAppleLoading(true);
      setError(null);
      
      // Check if Apple Sign-In is available (iOS 13+)
      if (!AppleAuthentication.isAvailableAsync()) {
        setError('Apple Sign-In is not available on this device');
        return;
      }

      // Perform Apple Sign-In
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('No identity token received from Apple');
      }

      const response = await api.appleAuth(credential.identityToken);

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Apple sign-in failed');
        return;
      }

      // Store backend JWT token
      if (data.token) {
        await AsyncStorage.setItem('token', data.token);
      }

      // Check if meal plan generation is in progress
      try {
        const statusResponse = await api.getGenerationStatus();

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();

          // If generation is in progress, redirect to loading page
          if (statusData.inProgress) {
            router.replace("/loading" as any);
            return;
          }
        }
      } catch (statusErr) {
        console.error("Error checking generation status:", statusErr);
        // Continue with normal flow if generation status check fails
      }

      // Navigate based on whether user is new or returning
      if (data.isNewUser) {
        // New user always goes to onboarding
        router.push("/onboarding/gender");
      } else {
        // Returning user: check if onboarding is complete
        const isOnboardingComplete = await checkOnboardingComplete();
        if (isOnboardingComplete) {
          router.replace("/account" as any);
        } else {
          router.replace("/onboarding/gender" as any);
        }
      }
    } catch (error: any) {
      if (error.code === 'ERR_CANCELED') {
        // User cancelled - no error message needed
      } else {
        setError(error.message || 'Apple sign-in failed. Please try again.');
      }
    } finally {
      setIsAppleLoading(false);
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
    <ScrollView 
      className="flex-1 bg-gradient-to-b from-blue-50 to-white"
      showsVerticalScrollIndicator={true}
      indicatorStyle="black"
    >
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

        </View>

        {/* Error Message */}
        {error && (
          <View className="w-full mb-4 bg-red-50 border border-red-200 rounded-xl p-4">
            <Text className="text-red-600 text-center">{error}</Text>
          </View>
        )}

        {/* Apple Sign-In Button (iOS only) */}
        {Platform.OS === 'ios' && (
          <View className="w-full mb-3">
            <TouchableOpacity 
              className="w-full bg-black py-5 px-6 rounded-2xl flex-row items-center justify-center shadow-lg"
              onPress={handleAppleSignIn}
              disabled={isAppleLoading}
              activeOpacity={0.8}
            >
              {isAppleLoading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Image
                    source={require('../assets/images/AppleLogo.png')}
                    style={{ width: 22, height: 22, marginRight: 12 }}
                    resizeMode="contain"
                  />
                  <Text className="text-white text-xl font-semibold">
                    Sign In with Apple
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Google Sign-In Button */}
        <View className="w-full mb-4">
          <TouchableOpacity 
            className="w-full bg-white py-5 px-6 rounded-2xl flex-row items-center justify-center shadow-lg border border-gray-200"
            onPress={handleGoogleSignIn}
            disabled={isGoogleLoading}
            activeOpacity={0.8}
          >
            {isGoogleLoading ? (
              <ActivityIndicator size="small" color="#666666" />
            ) : (
              <>
                <Image
                  source={require('../assets/images/GoogleLogo.png')}
                  style={{ width: 22, height: 22, marginRight: 12 }}
                  resizeMode="contain"
                />
                <Text className="text-gray-700 text-xl font-semibold">
                  Sign In with Google
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Legal Disclaimer */}
        <View className="mt-6 items-center px-4">
          <Text className="text-sm text-gray-500 text-center">
            By continuing, you agree to our{' '}
            <Text 
              className="underline"
              onPress={() => Linking.openURL('https://sites.google.com/dining-iq.com/legal/privacy-policy')}
            >
              Privacy Policy
            </Text>
            {' '}and{' '}
            <Text 
              className="underline"
              onPress={() => Linking.openURL('https://sites.google.com/dining-iq.com/legal/terms-of-service')}
            >
              Terms and Conditions
            </Text>
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
