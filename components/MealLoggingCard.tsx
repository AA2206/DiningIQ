// components/MealLoggingCard.tsx
import { View, Text, TouchableOpacity } from "react-native";
import '../global.css';

interface Entree {
  id: number;
  entree: string;
}

interface MealLoggingCardProps {
  mealId: number;
  mealName: string;
  description: string;
  calories: number;
  protein: number;
  entrees: Entree[];
  servingSize: number;
  onEdit: () => void;
  onAddServing: () => void;
  onRemoveServing: () => void;
  onRemove: () => void;
}

export default function MealLoggingCard({
  mealId,
  mealName,
  description,
  calories,
  protein,
  entrees,
  servingSize,
  onEdit,
  onAddServing,
  onRemoveServing,
  onRemove,
}: MealLoggingCardProps) {
  // Calculate display macros (base macros * serving size)
  const displayCalories = calories * servingSize;
  const displayProtein = protein * servingSize;

  return (
    <View className="bg-white rounded-xl mb-3 p-4 shadow-md border border-gray-200 flex-row">
      {/* Left side - Meal content */}
      <View className="flex-1 mr-3">
        {/* Meal Name */}
        <Text className="text-xl font-bold text-gray-900 mb-2">
          {mealName}
        </Text>

        {/* Nutritional Info Tags */}
        <View className="flex-row gap-2 mb-2">
          <View className="bg-gray-100 px-3 py-1 rounded-full">
            <Text className="text-sm text-gray-700 font-semibold">
              {displayProtein}g protein
            </Text>
          </View>
          <View className="bg-gray-100 px-3 py-1 rounded-full">
            <Text className="text-sm text-gray-700 font-semibold">
              {displayCalories} cal
            </Text>
          </View>
        </View>

        {/* Description */}
        {description && (
          <Text className="text-sm text-gray-600 mb-3 leading-5">
            {description}
          </Text>
        )}

        {/* Entrees Included */}
        <View className="mt-2">
          <Text className="text-xs font-bold text-gray-900 mb-2 uppercase tracking-wide">
            Entrees included:
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {entrees.map((entree, index) => (
              <View key={entree.id || index} className="bg-gray-100 px-2 py-1 rounded-full">
                <Text className="text-xs text-gray-700">
                  {entree.entree}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Right side - Action buttons */}
      <View className="items-center justify-center gap-2">
        {/* Edit button (pencil icon) */}
        <TouchableOpacity
          onPress={onEdit}
          className="w-8 h-8 items-center justify-center"
          activeOpacity={0.7}
        >
          <Text className="text-lg">✏️</Text>
        </TouchableOpacity>

        {/* Serving controls */}
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={onRemoveServing}
            className="w-8 h-8 bg-gray-200 rounded-full items-center justify-center"
            activeOpacity={0.7}
          >
            <Text className="text-lg font-bold text-gray-700">−</Text>
          </TouchableOpacity>
          
          <Text className="text-base font-semibold text-gray-900 min-w-[20px] text-center">
            {servingSize}
          </Text>
          
          <TouchableOpacity
            onPress={onAddServing}
            className="w-8 h-8 bg-gray-200 rounded-full items-center justify-center"
            activeOpacity={0.7}
          >
            <Text className="text-lg font-bold text-gray-700">+</Text>
          </TouchableOpacity>
        </View>

        {/* Remove button (X) */}
        <TouchableOpacity
          onPress={onRemove}
          className="w-8 h-8 items-center justify-center"
          activeOpacity={0.7}
        >
          <Text className="text-lg text-red-600 font-bold">✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

