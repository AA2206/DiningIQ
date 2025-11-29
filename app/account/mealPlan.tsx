// app/mealplan.tsx
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MealOptionCard from '../../components/MealOptionCard';
import '../../global.css';

interface Entree {
  id: number;
  entree: string;
}

interface MealOption {
  Meal_Option: string;
  Description: string;
  Entrees: Entree[];
  Calories?: number;
  Protein?: number;
}

interface MealPlanData {
  [mealType: string]: {
    [diningHall: string]: MealOption[];
  };
}

export default function MealPlan() {
  const [mealPlan, setMealPlan] = useState<MealPlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';

  useEffect(() => {
    fetchMealPlan();
  }, []);

  async function fetchMealPlan() {
    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        setError("Not authenticated. Please login again.");
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/get-meal-plan`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMealPlan(data.mealPlan);
      } else {
        setError("Failed to load meal plan");
      }
    } catch (err: any) {
      console.error("Error:", err);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Flatten meal options from all dining halls for a meal type
  function getMealOptionsForType(mealType: string): Array<{ mealOption: MealOption; diningHall: string }> {
    if (!mealPlan || !mealPlan[mealType]) return [];
    
    const mealTypeData = mealPlan[mealType];
    const allOptions: Array<{ mealOption: MealOption; diningHall: string }> = [];
    
    // Combine options from all dining halls, preserving dining hall info
    Object.entries(mealTypeData).forEach(([diningHall, diningHallOptions]) => {
      diningHallOptions.forEach((option) => {
        allOptions.push({ mealOption: option, diningHall });
      });
    });
    
    return allOptions;
  }

  // Get all meal types from the meal plan
  function getMealTypes(): string[] {
    if (!mealPlan) return [];
    return Object.keys(mealPlan);
  }

  // Format meal type name for display
  function formatMealType(mealType: string): string {
    return mealType.charAt(0).toUpperCase() + mealType.slice(1);
  }

  if (loading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-gray-600 mt-4">Loading your meal plan...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-6">
        <Text className="text-red-600 text-lg font-semibold text-center">
          {error}
        </Text>
      </View>
    );
  }

  if (!mealPlan) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-6">
        <Text className="text-gray-600 text-lg text-center">
          No meal plan found. Please generate one first.
        </Text>
      </View>
    );
  }

  const mealTypes = getMealTypes();

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="px-4 py-6">
        {mealTypes.map((mealType, index) => {
          const mealOptions = getMealOptionsForType(mealType);
          
          return (
            <View key={mealType} className={index > 0 ? "mt-8" : ""}>
              {/* Meal Type Header */}
              <Text className="text-3xl font-bold text-gray-900 mb-4">
                {formatMealType(mealType)}
              </Text>

              {/* Swipable Meal Option Cards */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                pagingEnabled={false}
                snapToInterval={340} // Card width + margin
                decelerationRate="fast"
                contentContainerStyle={{ paddingRight: 16 }}
              >
                {mealOptions.map(({ mealOption, diningHall }, optionIndex) => (
                  <View
                    key={optionIndex}
                    style={{ width: 340, marginRight: 16 }}
                  >
                    <MealOptionCard mealOption={mealOption} diningHall={diningHall} />
                  </View>
                ))}
              </ScrollView>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}