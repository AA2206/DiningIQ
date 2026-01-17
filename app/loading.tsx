// app/loading.tsx
import { View, Text, ActivityIndicator, Animated } from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useState, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import '../global.css';

const PROGRESS_BAR_WIDTH = 256; // w-64 = 256px

export default function Loading() {
  const router = useRouter();
  const [status, setStatus] = useState("Analyzing your preferences...");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const progressIntervalRef = useRef<number | null>(null);
  const statusUpdateRef = useRef<number[]>([]);
  const startTimeRef = useRef<number>(Date.now());
  const progressAnim = useRef(new Animated.Value(0)).current;

  const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';

  useEffect(() => {
    generateMealPlan();
    
    // Cleanup intervals on unmount
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      statusUpdateRef.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  // Start progress animation
  useEffect(() => {
    if (!error) {
      startTimeRef.current = Date.now();
      
      // Animate progress bar from 0% to 90% over 120 seconds (2 minutes)
      // (Will jump to 100% when API call completes)
      progressIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        // Increase progress based on time elapsed (target: 90% in 120 seconds)
        const newProgress = Math.min(90, (elapsed / 120) * 90);
        setProgress(newProgress);
        // Animate the progress bar smoothly
        Animated.timing(progressAnim, {
          toValue: newProgress,
          duration: 500,
          useNativeDriver: false,
        }).start();
      }, 500); // Update every 500ms

      // Update status messages over time (spread over 2 minutes)
      const statusMessages = [
        { time: 0, message: "Analyzing your preferences..." },
        { time: 15, message: "Generating breakfast options..." },
        { time: 35, message: "Creating lunch recommendations..." },
        { time: 60, message: "Finalizing dinner plans..." },
        { time: 90, message: "Almost done! Preparing your meal plan..." },
        { time: 110, message: "Final touches... Almost there!" },
      ];

      statusMessages.forEach(({ time, message }) => {
        const timeout = setTimeout(() => {
          setStatus(message);
        }, time * 1000);
        statusUpdateRef.current.push(timeout);
      });
    }
  }, [error]);

  async function generateMealPlan() {
    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        setError("Not authenticated. Please login again.");
        setTimeout(() => {
          router.push("/login" as any);
        }, 2000);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/generate-meal-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      // Clear intervals
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      statusUpdateRef.current.forEach(timeout => clearTimeout(timeout));
      statusUpdateRef.current = [];

      if (response.ok) {
        // Animate to 100%
        setProgress(100);
        Animated.timing(progressAnim, {
          toValue: 100,
          duration: 300,
          useNativeDriver: false,
        }).start();
        setStatus("Meal plan generated successfully!");
        // Navigate to meal plan screen after a brief delay
        setTimeout(() => {
          router.replace("/account" as any);
        }, 1000);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to generate meal plan");
        setTimeout(() => {
          router.push("/onboarding/other" as any);
        }, 3000);
      }
    } catch (err: any) {
      console.error("Error:", err);
      // Clear intervals on error
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      statusUpdateRef.current.forEach(timeout => clearTimeout(timeout));
      statusUpdateRef.current = [];
      setError("Network error. Please try again.");
      setTimeout(() => {
        router.push("/onboarding/other" as any);
      }, 3000);
    }
  }

  return (
    <View className="flex-1 bg-white items-center justify-center px-6">
      {/* Loading Spinner */}
      <ActivityIndicator size="large" color="#2563eb" className="mb-8" />

      {/* Status Text */}
      {error ? (
        <View className="items-center">
          <Text className="text-red-600 text-lg font-semibold mb-2 text-center">
            {error}
          </Text>
          <Text className="text-gray-500 text-sm text-center">
            Redirecting...
          </Text>
        </View>
      ) : (
        <View className="items-center">
          <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">
            Creating Your Meal Plan
          </Text>
          <Text className="text-lg text-gray-600 text-center mb-1">
            {status}
          </Text>
          <Text className="text-sm text-gray-500 text-center mt-2">
            This may take about 2 minutes. We're creating personalized meal plans just for you!
          </Text>
        </View>
      )}

      {/* Progress Indicator */}
      {!error && (
        <View className="mt-8 w-64">
          <View className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <Animated.View 
              className="h-full bg-blue-600 rounded-full" 
              style={{ 
                width: progressAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: [0, PROGRESS_BAR_WIDTH],
                })
              }} 
            />
          </View>
          <Text className="text-xs text-gray-500 text-center mt-2">
            {Math.round(progress)}% complete
          </Text>
        </View>
      )}
    </View>
  );
}