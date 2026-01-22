// app/index.tsx
import { View, Text, ScrollView, ActivityIndicator, Platform, Linking, Image } from "react-native";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import '../global.css';

// Configure Google Sign-In
GoogleSignin.configure({
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
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
  async function checkOnboardingComplete(token: string): Promise<boolean> {
    const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
    try {
      const response = await fetch(`${API_BASE_URL}/user-profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

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
        const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
        
        // First, check if meal plan generation is in progress
        try {
          const statusResponse = await fetch(`${API_BASE_URL}/generation-status`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

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
          const response = await fetch(`${API_BASE_URL}/user-profile`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

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
          } else if (response.status === 401) {
            // Token is invalid, clear it and show landing page
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

      // Check if meal plan generation is in progress
      try {
        const statusResponse = await fetch(`${API_BASE_URL}/generation-status`, {
          headers: {
            Authorization: `Bearer ${data.token}`,
          },
        });

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
        const isOnboardingComplete = await checkOnboardingComplete(data.token);
        if (isOnboardingComplete) {
          router.replace("/account" as any);
        } else {
          router.replace("/onboarding/gender" as any);
        }
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

      console.log('Apple Sign-In Result:', JSON.stringify(credential, null, 2));

      // Always use Apple user ID as the primary identifier
      // credential.user is consistent across sign-ins, even with "Hide My Email"
      const appleId = credential.user;
      const email = credential.email; // May be null on subsequent sign-ins, that's okay
      const name = credential.fullName 
        ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
        : null;

      // Send Apple user info to backend
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
      
      const response = await fetch(`${API_BASE_URL}/apple-auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          appleId: appleId, // Always send the Apple user ID (required)
          email: email, // Optional, may be null on subsequent sign-ins
          name: name,
          identityToken: credential.identityToken, // Optional: for verification
        }),
      });

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
        const statusResponse = await fetch(`${API_BASE_URL}/generation-status`, {
          headers: {
            Authorization: `Bearer ${data.token}`,
          },
        });

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
        const isOnboardingComplete = await checkOnboardingComplete(data.token);
        if (isOnboardingComplete) {
          router.replace("/account" as any);
        } else {
          router.replace("/onboarding/gender" as any);
        }
      }
    } catch (error: any) {
      console.log('Apple Sign-In Error:', error);
      
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
