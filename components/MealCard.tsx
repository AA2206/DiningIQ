// components/MealCard.tsx
import { View, Text, TouchableOpacity } from "react-native";
import '../global.css';

interface Entree {
  id: number;
  entree: string;
  servingSize: number;
}

interface MealCardProps {
  mealName: string;
  mealDescription?: string;
  totalCalories: number;
  totalProtein: number;
  entrees: Entree[];
  servingSize: number;
  onRemove?: () => void;
  onEdit?: () => void;
  onIncreaseServing?: () => void;
  onDecreaseServing?: () => void;
}

export default function MealCard({
  mealName,
  mealDescription,
  totalCalories,
  totalProtein,
  entrees,
  servingSize,
  onRemove,
  onEdit,
  onIncreaseServing,
  onDecreaseServing,
}: MealCardProps) {
  // Calculate display macros (base macros * serving size)
  const displayCalories = Math.round(totalCalories * servingSize);
  const displayProtein = (totalProtein * servingSize).toFixed(1);

  console.log(entrees)

  return (
    <View className="bg-white rounded-xl p-4 shadow-md border border-gray-200">
      {/* Header with Meal Name and Action Buttons */}
      <View className="flex-row items-start justify-between mb-2">
        <Text className="text-xl font-bold text-gray-900 flex-1 mr-2">
          {mealName}
        </Text>
        <View className="flex-row items-center gap-2">
          {onEdit && (
            <TouchableOpacity
              onPress={onEdit}
              className="w-6 h-6 items-center justify-center"
              activeOpacity={0.7}
            >
              <Text className="text-blue-600 text-sm font-semibold">✎</Text>
            </TouchableOpacity>
          )}
          {onRemove && (
            <TouchableOpacity
              onPress={onRemove}
              className="w-6 h-6 items-center justify-center"
              activeOpacity={0.7}
            >
              <Text className="text-gray-500 text-lg font-bold">×</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

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

      {/* Serving Size Controls */}
      {(onIncreaseServing || onDecreaseServing) && (
        <View className="flex-row items-center gap-3 mb-2">
          <Text className="text-sm text-gray-700 font-medium">Serving Size:</Text>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={onDecreaseServing}
              disabled={servingSize <= 1}
              className={`w-8 h-8 items-center justify-center rounded-full ${
                servingSize <= 1 ? 'bg-gray-200' : 'bg-green-600'
              }`}
              activeOpacity={0.7}
            >
              <Text className={`text-lg font-bold ${servingSize <= 1 ? 'text-gray-400' : 'text-white'}`}>
                −
              </Text>
            </TouchableOpacity>
            <Text className="text-base font-bold text-gray-900 min-w-[24px] text-center">
              {servingSize}
            </Text>
            <TouchableOpacity
              onPress={onIncreaseServing}
              className="w-8 h-8 items-center justify-center bg-green-600 rounded-full"
              activeOpacity={0.7}
            >
              <Text className="text-lg font-bold text-white">+</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Description */}
      {mealDescription && (
        <Text className="text-sm text-gray-600 mb-3 leading-5">
          {mealDescription}
        </Text>
      )}

      {/* Entrees Included */}
      {entrees && entrees.length > 0 && (
        <View className="mt-2">
          <Text className="text-xs font-bold text-gray-900 mb-2 uppercase tracking-wide">
            Entrees included:
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {entrees.map((entree, index) => {
              // Extract entree name - handle {id, entree, servingSize} format
              let entreeName = '';
              if (typeof entree === 'string') {
                entreeName = entree;
              } else if (entree && typeof entree === 'object') {
                entreeName = entree.entree || '';
              }
              
              const entreeId = typeof entree === 'object' && entree ? (entree.id || index) : index;
              
              // Only render if we have a valid entree name
              if (!entreeName) {
                console.log('Entree without name:', entree);
                return null;
              }
              
              return (
                <View
                  key={entreeId}
                  className="bg-gray-100 px-2 py-1 rounded-full"
                >
                  <Text className="text-xs text-gray-700">
                    {entreeName}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

