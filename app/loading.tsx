// app/loading.tsx
import { View, Text, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import '../global.css';

export default function Loading() {
  const router = useRouter();
  const [status, setStatus] = useState("Generating your personalized meal plan...");
  const [error, setError] = useState("");

  const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';

  useEffect(() => {
    generateMealPlan();
  }, []);

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

      setStatus("Analyzing your preferences...");

      const response = await fetch(`${API_BASE_URL}/generate-meal-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setStatus("Meal plan generated successfully!");
        // Navigate to meal plan screen after a brief delay
        setTimeout(() => {
          router.push("/account" as any); // Adjust route as needed
        }, 1000);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to generate meal plan");
        setTimeout(() => {
          router.push("/onboarding/other" as any); // Go back on error
        }, 3000);
      }
    } catch (err: any) {
      console.error("Error:", err);
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
          <Text className="text-lg text-gray-600 text-center">
            {status}
          </Text>
        </View>
      )}

      {/* Progress Indicator */}
      {!error && (
        <View className="mt-8 w-64">
          <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <View className="h-full bg-blue-600 rounded-full" style={{ width: '60%' }} />
          </View>
        </View>
      )}
    </View>
  );
}