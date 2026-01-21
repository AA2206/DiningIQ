// app/mealplan.tsx
import { View, Text, ScrollView, ActivityIndicator, Dimensions, FlatList, Alert } from "react-native";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MealOptionCard from '../../components/MealOptionCard';
import '../../global.css';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;

interface Entree {
  id: number;
  entree: string;
  servingSize: number;
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
  const [addingMealKey, setAddingMealKey] = useState<string | null>(null);

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

  // Convert dining hall key to display name for storage
  function formatDiningHallName(hall: string): string {
    const diningHallMap: { [key: string]: string } = {
      'South_Campus_Dining_Hall': 'South Campus',
      'south_campus_dining_hall': 'South Campus',
      'Yahentamitsi_Dining_Hall': 'Yahentamitsi Dining Hall',
      'yahentamitsi_dining_hall': 'Yahentamitsi Dining Hall',
      'North_251_Dining_Hall': '251 North',
      'north_251_dining_hall': '251 North',
      '251_North': '251 North',
    };
    return diningHallMap[hall] || hall;
  }

  // Helper function to get current hour and minute in EST
  function getESTTime(): { hour: number; minute: number } {
    const now = new Date();
    // EST is UTC-5, EDT is UTC-4
    // Use toLocaleString to get EST time
    const estTimeString = now.toLocaleString('en-US', { 
      timeZone: 'America/New_York', 
      hour: 'numeric', 
      minute: 'numeric',
      hour12: false 
    });
    const [hour, minute] = estTimeString.split(':').map(Number);
    return { hour, minute };
  }

  // Helper function to calculate effective date
  // - Before 3 AM EST: yesterday (can still edit/add previous day)
  // - 3 AM to 4:29 AM EST: no access (returns null)
  // - 4:30 AM EST or later: today (can edit/add current day)
  function getEffectiveDate(): Date | null {
    const now = new Date();
    const { hour, minute } = getESTTime();
    
    // 3 AM to 4:29 AM EST: no access
    if (hour === 3 || (hour === 4 && minute < 30)) {
      return null;
    }
    
    const resultDate = new Date(now);
    
    // Before 3 AM EST: use yesterday as effective date
    if (hour < 3) {
      resultDate.setDate(now.getDate() - 1);
    }
    // 4:30 AM EST or later: use today as effective date (already set)
    
    resultDate.setHours(0, 0, 0, 0);
    return resultDate;
  }

  async function handleAddMeal(
    mealOption: MealOption,
    diningHall: string,
    mealType: string,
    uniqueKey: string
  ) {
    try {
      setAddingMealKey(uniqueKey);
      
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "Not authenticated. Please login again.");
        return;
      }

      const entrees = mealOption.Entrees.map((entree) => ({
        id: entree.id,
        servingSize: entree.servingSize || 1,
      }));

      // Map Brunch meals to Lunch in Meal Logging
      const targetMealType = mealType === "Brunch" ? "Lunch" : mealType;

      // Use effective date instead of current date
      const targetDate = getEffectiveDate();
      
      if (!targetDate) {
        Alert.alert("Error", "Cannot add meals during 3-4:30 AM EST window. Please try again after 4:30 AM EST.");
        setAddingMealKey(null);
        return;
      }

      const payload = {
        mealName: mealOption.Meal_Option,
        mealDescription: mealOption.Description,
        mealType: targetMealType, // Brunch → Lunch, others stay the same
        date: targetDate.toISOString(),
        diningHall: formatDiningHallName(diningHall),
        entrees: entrees,
        servingSize: 1,
      };

      const response = await fetch(`${API_BASE_URL}/add-meal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        Alert.alert("Success", `${mealOption.Meal_Option} added to your meal log!`);
      } else {
        const data = await response.json();
        Alert.alert("Error", data.error || "Failed to add meal");
      }
    } catch (err: any) {
      console.error("Error adding meal:", err);
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setAddingMealKey(null);
    }
  }

  function getMealOptionsForType(mealType: string): Array<{ mealOption: MealOption; diningHall: string }> {
    if (!mealPlan || !mealPlan[mealType]) return [];
    
    const mealTypeData = mealPlan[mealType];
    const allOptions: Array<{ mealOption: MealOption; diningHall: string }> = [];
    
    Object.entries(mealTypeData).forEach(([diningHall, diningHallOptions]) => {
      diningHallOptions.forEach((option) => {
        allOptions.push({ mealOption: option, diningHall });
      });
    });
    
    return allOptions;
  }

  function getMealTypes(): string[] {
    if (!mealPlan) return [];
    const preferredOrder = ['Breakfast', 'Brunch', 'Lunch', 'Dinner'];
    const availableTypes = Object.keys(mealPlan);
    return availableTypes.sort((a, b) => {
      const indexA = preferredOrder.indexOf(a);
      const indexB = preferredOrder.indexOf(b);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }

  function formatMealType(mealType: string): string {
    return mealType.charAt(0).toUpperCase() + mealType.slice(1);
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center" edges={['top']}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-gray-600 mt-4">Loading your meal plan...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center px-6" edges={['top']}>
        <Text className="text-red-600 text-lg font-semibold text-center">
          {error}
        </Text>
      </SafeAreaView>
    );
  }

  if (!mealPlan) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center px-6" edges={['top']}>
        <Text className="text-gray-600 text-lg text-center">
          No meal plan found. Please generate one first.
        </Text>
      </SafeAreaView>
    );
  }

  const mealTypes = getMealTypes();

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <ScrollView 
        className="flex-1"
        showsVerticalScrollIndicator={true}
        indicatorStyle="black"
      >
        <View className="px-4 pt-6 pb-4">
          <Text className="text-4xl font-bold text-gray-900 mb-2">
            Meal Plan
          </Text>
          <Text className="text-base text-gray-600">
            Curated meals for optimal nutrition
          </Text>
        </View>

        {mealTypes.map((mealType, index) => {
          const mealOptions = getMealOptionsForType(mealType);
          
          return (
            <View key={mealType} className={index > 0 ? "mt-6" : ""}>
              <Text className="text-2xl font-bold text-gray-900 mb-4 px-4">
                {formatMealType(mealType)}
              </Text>

              <FlatList
                data={mealOptions}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_WIDTH + 12}
                snapToAlignment="start"
                decelerationRate="fast"
                contentContainerStyle={{ paddingHorizontal: 16 }}
                ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
                renderItem={({ item: { mealOption, diningHall }, index: idx }) => {
                  const uniqueKey = `${mealType}-${diningHall}-${idx}`;
                  return (
                    <View style={{ width: CARD_WIDTH }}>
                      <MealOptionCard 
                        mealOption={mealOption} 
                        diningHall={diningHall}
                        onAddMeal={() => handleAddMeal(mealOption, diningHall, mealType, uniqueKey)}
                        isAdding={addingMealKey === uniqueKey}
                      />
                    </View>
                  );
                }}
                keyExtractor={(_, idx) => idx.toString()}
              />
            </View>
          );
        })}
        
        <View className="h-6" />
      </ScrollView>
    </SafeAreaView>
  );
}
