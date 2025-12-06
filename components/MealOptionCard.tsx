// components/MealOptionCard.tsx
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import '../global.css';

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

interface MealOptionCardProps {
  mealOption: MealOption;
  diningHall: string;
  onAddMeal?: () => void;
  isAdding?: boolean;
}

export default function MealOptionCard({ 
  mealOption, 
  diningHall,
  onAddMeal,
  isAdding 
}: MealOptionCardProps) {
  // Map dining hall codes to display names
  const formatDiningHall = (hall: string): string => {
    const diningHallMap: { [key: string]: string } = {
      'South_Campus_Dining_Hall': 'South Campus',
      'south_campus_dining_hall': 'South Campus',
      'Yahentamitsi_Dining_Hall': 'Yahentamitsi Dining Hall',
      'yahentamitsi_dining_hall': 'Yahentamitsi Dining Hall',
      'North_251_Dining_Hall': '251 North',
      'north_251_dining_hall': '251 North',
      '251_North': '251 North',
    };
    
    return diningHallMap[hall] || hall.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  };

  return (
    <View 
      className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
    >
      {/* Blue Location Bar with Add Button */}
      <View className="bg-blue-600 px-4 py-3 flex-row justify-between items-center">
        <Text className="text-white text-base font-semibold">
          {formatDiningHall(diningHall)}
        </Text>
        
        {onAddMeal && (
          <TouchableOpacity 
            onPress={onAddMeal}
            disabled={isAdding}
            className="bg-white rounded-full w-8 h-8 items-center justify-center"
            activeOpacity={0.7}
          >
            {isAdding ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : (
              <Ionicons name="add" size={22} color="#2563eb" />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Main Content with Arrow */}
      <View className="px-5 py-4 flex-row">
        <View className="flex-1 pr-4">
          {/* Meal Name */}
          <Text className="text-2xl font-bold text-gray-900 mb-3">
            {mealOption.Meal_Option}
          </Text>

          {/* Nutritional Information Tags */}
          <View className="flex-row gap-2 mb-4">
            {mealOption.Protein !== undefined && (
              <View className="bg-blue-100 px-3 py-1.5 rounded-full">
                <Text className="text-sm font-semibold text-green-800">
                  {mealOption.Protein}g protein
                </Text>
              </View>
            )}
            {mealOption.Calories !== undefined && (
              <View className="bg-blue-100 px-3 py-1.5 rounded-full">
                <Text className="text-sm font-semibold text-green-800">
                  {mealOption.Calories} cal
                </Text>
              </View>
            )}
          </View>

          {/* Description */}
          <Text className="text-sm text-gray-700 leading-6 mb-4">
            {mealOption.Description}
          </Text>

          {/* Items Included Section */}
          <View className="border-t border-gray-200 pt-4">
            <View className="flex-row items-center mb-3">
              <Text className="text-xs font-bold text-gray-900 uppercase tracking-wide mr-2">
                Items Included
              </Text>
              <Text className="text-gray-600">🍴</Text>
            </View>
            
            {/* Items List */}
            <View className="gap-2">
              {mealOption.Entrees.map((entree, index) => (
                <View key={entree.id || index} className="flex-row items-start">
                  <Text className="text-gray-700 mr-2">•</Text>
                  <Text className="text-sm text-gray-700 flex-1">
                    {entree.entree}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
        
        {/* Arrow Indicator */}
        <View className="justify-center">
          <Text className="text-gray-400 text-2xl">›</Text>
        </View>
      </View>
    </View>
  );
}
