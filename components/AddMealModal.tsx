// components/AddMealModal.tsx
import { View, Text, Modal, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { useState, useEffect, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import '../global.css';

interface Entree {
  id: number;
  entree: string;
  totalCalories: number;
  totalFat: number;
  totalCarbohydrate: number;
  protein: number;
}

interface EntreeOption {
  id: number;
  entree: string;
  totalCalories: number;
  totalFat: number;
  totalCarbohydrate: number;
  protein: number;
}

interface MealData {
  id?: number;
  mealName: string;
  mealDescription: string;
  mealType: string;
  diningHall: string;
  entrees: Array<{ id: number; entree: string }>;
}

interface AddMealModalProps {
  visible: boolean;
  onClose: () => void;
  mealType: string;
  onSubmit: (data: {
    mealName: string;
    mealDescription: string;
    diningHall: string;
    entrees: Array<{ id: number; entree: string }>;
    calculatedMacros: {
      calories: number;
      protein: number;
      carbs: number;
      fats: number;
    };
  }) => void;
  initialData?: MealData | null;
}

const DINING_HALLS = [
  "251 North",
  "South Campus",
  "Yahentamitisi Dining Hall",
];

export default function AddMealModal({
  visible,
  onClose,
  mealType,
  onSubmit,
  initialData,
}: AddMealModalProps) {
  const [mealName, setMealName] = useState("");
  const [mealDescription, setMealDescription] = useState("");
  const [diningHall, setDiningHall] = useState("");
  const [entreeOptions, setEntreeOptions] = useState<EntreeOption[]>([]);
  const [selectedEntreeIds, setSelectedEntreeIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingEntrees, setFetchingEntrees] = useState(false);
  const [error, setError] = useState("");

  const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';

  // Reset form when modal opens/closes or when editing
  useEffect(() => {
    if (visible) {
      if (initialData) {
        // Editing mode - pre-fill form
        setMealName(initialData.mealName);
        setMealDescription(initialData.mealDescription || "");
        setDiningHall(initialData.diningHall);
        // Note: We'll need to fetch entrees and match selected ones
        // For now, we'll fetch when dining hall is set
      } else {
        // Add mode - reset form
        setMealName("");
        setMealDescription("");
        setDiningHall("");
        setSelectedEntreeIds(new Set());
        setSearchQuery("");
      }
      setError("");
    }
  }, [visible, initialData]);

  // Fetch entrees when dining hall changes
  useEffect(() => {
    if (visible && diningHall) {
      fetchEntrees();
    }
  }, [diningHall, mealType, visible]);

  // When editing and entrees are loaded, select the initial entrees
  useEffect(() => {
    if (initialData && entreeOptions.length > 0 && diningHall === initialData.diningHall) {
      const selectedIds = new Set<number>();
      initialData.entrees.forEach((entree) => {
        // Match by ID first, then by name as fallback
        const foundEntree = entreeOptions.find(
          (opt) => opt.id === entree.id || opt.entree === entree.entree
        );
        if (foundEntree) {
          selectedIds.add(foundEntree.id);
        }
      });
      setSelectedEntreeIds(selectedIds);
    }
  }, [entreeOptions, initialData, diningHall]);

  async function fetchEntrees() {
    if (!diningHall || !mealType) return;

    setFetchingEntrees(true);
    setError("");

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        setError("Not authenticated. Please login again.");
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/fetchAllEntrees?diningHall=${encodeURIComponent(diningHall)}&mealType=${encodeURIComponent(mealType)}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setEntreeOptions(data.entrees || []);
        // Reset selected entrees when dining hall changes
        if (!initialData || diningHall !== initialData.diningHall) {
          setSelectedEntreeIds(new Set());
          setSearchQuery("");
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to fetch entrees");
      }
    } catch (err: any) {
      console.error("Error fetching entrees:", err);
      setError("Network error. Please try again.");
    } finally {
      setFetchingEntrees(false);
    }
  }

  function toggleEntreeSelection(entreeId: number) {
    const newSet = new Set(selectedEntreeIds);
    if (newSet.has(entreeId)) {
      newSet.delete(entreeId);
    } else {
      newSet.add(entreeId);
    }
    setSelectedEntreeIds(newSet);
  }

  // Filter entrees based on search query
  const filteredEntrees = useMemo(() => {
    if (!searchQuery.trim()) {
      return entreeOptions;
    }
    const query = searchQuery.toLowerCase().trim();
    return entreeOptions.filter((entree) =>
      entree.entree.toLowerCase().includes(query)
    );
  }, [entreeOptions, searchQuery]);

  function calculateMacros(): { calories: number; protein: number; carbs: number; fats: number } {
    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fats = 0;

    selectedEntreeIds.forEach((entreeId) => {
      const entree = entreeOptions.find((opt) => opt.id === entreeId);
      if (entree) {
        calories += entree.totalCalories;
        protein += entree.protein;
        carbs += entree.totalCarbohydrate;
        fats += entree.totalFat;
      }
    });

    return { calories, protein, carbs, fats };
  }

  function handleSubmit() {
    // Validation
    if (!mealName.trim()) {
      setError("Meal name is required");
      return;
    }

    if (!diningHall) {
      setError("Please select a dining hall");
      return;
    }

    if (selectedEntreeIds.size === 0) {
      setError("Please select at least one entree");
      return;
    }

    // Get selected entrees with IDs
    const selectedEntrees = Array.from(selectedEntreeIds)
      .map((entreeId) => {
        const entree = entreeOptions.find((opt) => opt.id === entreeId);
        if (entree) {
          return {
            id: entree.id,
            entree: entree.entree,
          };
        }
        return null;
      })
      .filter((entree): entree is { id: number; entree: string } => entree !== null);

    const calculatedMacros = calculateMacros();

    onSubmit({
      mealName: mealName.trim(),
      mealDescription: mealDescription.trim(),
      diningHall,
      entrees: selectedEntrees,
      calculatedMacros,
    });
  }

  function formatDiningHall(hall: string): string {
    return hall
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 items-center justify-center px-4">
        <View className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90%]">
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-2xl font-bold text-gray-900">
                {initialData ? "Edit Meal" : "Add Meal"}
              </Text>
              <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                <Text className="text-2xl text-gray-500">✕</Text>
              </TouchableOpacity>
            </View>

            {/* Error Message */}
            {error ? (
              <View className="mb-4">
                <Text className="text-red-600 text-sm">{error}</Text>
              </View>
            ) : null}

            {/* Meal Name */}
            <View className="mb-4">
              <Text className="text-base font-semibold text-gray-700 mb-2">
                Meal Name *
              </Text>
              <TextInput
                className="h-12 px-4 text-base bg-gray-50 border border-gray-200 rounded-xl"
                placeholder="Enter meal name"
                value={mealName}
                onChangeText={setMealName}
              />
            </View>

            {/* Meal Description */}
            <View className="mb-4">
              <Text className="text-base font-semibold text-gray-700 mb-2">
                Description (Optional)
              </Text>
              <TextInput
                className="h-20 px-4 py-2 text-base bg-gray-50 border border-gray-200 rounded-xl"
                placeholder="Enter meal description"
                value={mealDescription}
                onChangeText={setMealDescription}
                multiline
              />
            </View>

            {/* Dining Hall */}
            <View className="mb-4">
              <Text className="text-base font-semibold text-gray-700 mb-2">
                Dining Hall *
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {DINING_HALLS.map((hall) => (
                  <TouchableOpacity
                    key={hall}
                    onPress={() => setDiningHall(hall)}
                    className={`px-4 py-2 rounded-xl border-2 ${
                      diningHall === hall
                        ? "bg-blue-600 border-blue-600"
                        : "bg-white border-gray-300"
                    }`}
                    activeOpacity={0.7}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        diningHall === hall ? "text-white" : "text-gray-700"
                      }`}
                    >
                      {formatDiningHall(hall)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Entrees Selection */}
            <View className="mb-4">
              <Text className="text-base font-semibold text-gray-700 mb-2">
                Select Entrees *
              </Text>
              {fetchingEntrees ? (
                <View className="items-center py-4">
                  <ActivityIndicator size="small" color="#2563eb" />
                  <Text className="text-gray-500 text-sm mt-2">Loading entrees...</Text>
                </View>
              ) : entreeOptions.length === 0 ? (
                <Text className="text-gray-500 text-sm">
                  {diningHall ? "No entrees available. Please select a dining hall." : "Please select a dining hall first."}
                </Text>
              ) : (
                <View>
                  {/* Search Bar */}
                  <TextInput
                    className="h-10 px-4 mb-3 text-base bg-gray-50 border border-gray-200 rounded-xl"
                    placeholder="Search entrees..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  
                  {/* Entrees List */}
                  <View className="max-h-48 border border-gray-200 rounded-xl p-2">
                    <ScrollView nestedScrollEnabled>
                      {filteredEntrees.length === 0 ? (
                        <Text className="text-gray-500 text-sm text-center py-4">
                          No entrees found matching "{searchQuery}"
                        </Text>
                      ) : (
                        filteredEntrees.map((entree) => {
                          const isSelected = selectedEntreeIds.has(entree.id);
                          return (
                            <TouchableOpacity
                              key={entree.id}
                              onPress={() => toggleEntreeSelection(entree.id)}
                              className={`p-3 mb-2 rounded-lg border-2 ${
                                isSelected
                                  ? "bg-blue-50 border-blue-600"
                                  : "bg-white border-gray-200"
                              }`}
                              activeOpacity={0.7}
                            >
                              <Text
                                className={`text-sm font-medium ${
                                  isSelected ? "text-blue-900" : "text-gray-700"
                                }`}
                              >
                                {entree.entree}
                              </Text>
                              {isSelected && (
                                <Text className="text-xs text-blue-600 mt-1">
                                  {entree.totalCalories} cal • {entree.protein}g protein
                                </Text>
                              )}
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </ScrollView>
                  </View>
                  
                  {/* Selected count */}
                  {selectedEntreeIds.size > 0 && (
                    <Text className="text-xs text-gray-500 mt-2">
                      {selectedEntreeIds.size} entree{selectedEntreeIds.size !== 1 ? 's' : ''} selected
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* Calculated Macros Preview */}
            {selectedEntreeIds.size > 0 && (
              <View className="mb-4 p-3 bg-gray-50 rounded-xl">
                <Text className="text-sm font-semibold text-gray-700 mb-2">
                  Total Macros:
                </Text>
                <View className="flex-row gap-4">
                  <Text className="text-sm text-gray-600">
                    {calculateMacros().calories} cal
                  </Text>
                  <Text className="text-sm text-gray-600">
                    {calculateMacros().protein.toFixed(1)}g protein
                  </Text>
                </View>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              className="w-full bg-blue-600 py-4 rounded-xl items-center mt-2"
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text className="text-white text-lg font-semibold">
                  {initialData ? "Update Meal" : "Add Meal"}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

