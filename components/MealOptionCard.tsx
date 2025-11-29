// components/MealOptionCard.tsx
import { View, Text } from "react-native";
import '../global.css';

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

interface MealOptionCardProps {
  mealOption: MealOption;
  diningHall: string;
}

export default function MealOptionCard({ mealOption, diningHall }: MealOptionCardProps) {
  // Format dining hall name for display
  const formatDiningHall = (hall: string): string => {
    return hall
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  return (
    <View className="bg-white rounded-2xl mb-4 shadow-lg border border-gray-100 overflow-hidden">
      {/* Teal Blue Header */}
      <View className="bg-teal-600 px-5 py-4 flex-row items-center justify-between">
        <View className="bg-white px-3 py-1.5 rounded-lg">
          <Text className="text-xs font-bold text-teal-900 uppercase tracking-wide">
            {formatDiningHall(diningHall)}
          </Text>
        </View>
        <View className="w-8 h-8 bg-teal-400 rounded-full opacity-30" />
      </View>

      {/* Main Content */}
      <View className="px-5 py-4">
        {/* Title */}
        <Text className="text-3xl font-bold text-gray-900 mb-3">
          {mealOption.Meal_Option}
        </Text>

        {/* Nutritional Information */}
        <View className="flex-row gap-4 mb-4">
          {mealOption.Calories !== undefined && (
            <View className="flex-row items-center gap-1.5">
              <Text className="text-xl">🔥</Text>
              <Text className="text-base font-semibold text-gray-900">
                {mealOption.Calories}
              </Text>
            </View>
          )}
          {mealOption.Protein !== undefined && (
            <View className="flex-row items-center gap-1.5">
              <Text className="text-xl">⚡</Text>
              <Text className="text-base font-semibold text-gray-900">
                {mealOption.Protein}g
              </Text>
            </View>
          )}
        </View>

        {/* Description */}
        <Text className="text-base text-gray-700 leading-6 mb-4">
          {mealOption.Description}
        </Text>

        {/* Items Included Section */}
        <View className="border-t border-gray-300 pt-4">
          <Text className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">
            Items Included
          </Text>
          
          {/* Single Column Layout */}
          <View>
            {mealOption.Entrees.map((entree, index) => (
              <View key={entree.id || index} className="flex-row items-start mb-2">
                <Text className="text-red-600 mr-2 text-base">•</Text>
                <Text className="text-sm text-gray-700 flex-1">
                  {entree.entree}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}