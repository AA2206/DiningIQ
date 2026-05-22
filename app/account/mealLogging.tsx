// app/account/mealLogging.tsx
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useState, useEffect, useMemo, useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useFocusEffect } from "@react-navigation/native";
import MealCard from '../../components/MealCard';
import '../../global.css';
import { api } from '../../lib/api';

// Interface for Entree
interface Entree {
  id: number;
  entree: string;
  servingSize: number
}

// Interface for Entree Option (from API)
interface EntreeOption {
  id: number;
  entree: string;
  totalCalories: number;
  totalFat: number;
  totalCarbohydrate: number;
  protein: number;
}

// Interface for Meal Data
interface MealData {
  id: number;
  mealName: string;
  mealDescription: string;
  mealType: string;
  date: Date;
  diningHall: string;
  servingSize: number;
  entrees: Entree[];
  totalCalories: number; // Base calories (1 serving)
  totalProtein: number; // Base protein (1 serving)
  totalCarbs: number;
  totalFats: number;
}

export default function MealLogging() {
  // State: 4 HashMaps for each meal type
  const [breakfastMeals, setBreakfastMeals] = useState<Map<string, MealData>>(new Map());
  const [lunchMeals, setLunchMeals] = useState<Map<string, MealData>>(new Map());
  const [dinnerMeals, setDinnerMeals] = useState<Map<string, MealData>>(new Map());
  const [brunchMeals, setBrunchMeals] = useState<Map<string, MealData>>(new Map());

  // State: Selected date
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // State: Modal visibility and meal type
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMealType, setModalMealType] = useState(""); // "Breakfast", "Lunch", "Dinner", "Brunch"
  const [editingMeal, setEditingMeal] = useState<MealData | null>(null); // null when adding, MealData when editing

  // Form state
  const [mealName, setMealName] = useState("");
  const [mealDescription, setMealDescription] = useState("");
  const [diningHall, setDiningHall] = useState("");
  const [selectedEntrees, setSelectedEntrees] = useState<Map<number, number>>(new Map()); // Map<entreeId, servingSize>
  
  // Entrees options state
  const [entreeOptions, setEntreeOptions] = useState<EntreeOption[]>([]);
  const [fetchingEntrees, setFetchingEntrees] = useState(false);
  const [entreeSearchQuery, setEntreeSearchQuery] = useState("");

  // State: Current week start (Monday)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = selectedDate
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - day + (day === 0 ? -6 : 1)); // Adjust to Monday
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  // Copy Modal State
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [mealToCopy, setMealToCopy] = useState<MealData | null>(null);
  const [selectedCopyMealType, setSelectedCopyMealType] = useState<string>("");
  const [copyingMeal, setCopyingMeal] = useState(false);
  const [verifyingCopy, setVerifyingCopy] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [availableMealTypes, setAvailableMealTypes] = useState<string[]>([]);

  // Dining Hall Options
  const DINING_HALLS = ["South Campus", "Yahentamitsi Dining Hall", "251 North"];

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
    
    const effectiveDate = new Date(now);
    
    // Before 3 AM EST: use yesterday as effective date
    if (hour < 3) {
      effectiveDate.setDate(now.getDate() - 1);
    }
    // 4:30 AM EST or later: use today as effective date (already set)
    
    effectiveDate.setHours(0, 0, 0, 0);
    return effectiveDate;
  }

  // Helper function to check if a date is accessible for adding/editing meals
  function isDateAccessible(date: Date): boolean {
    const effectiveDate = getEffectiveDate();
    
    // If no effective date (3-4:30 AM EST window), no dates are accessible
    if (!effectiveDate) {
      return false;
    }
    
    const dateToCheck = new Date(date);
    dateToCheck.setHours(0, 0, 0, 0);
    
    return dateToCheck.getTime() === effectiveDate.getTime();
  }

  // Function to fetch meals for a given date
  async function fetchMeals(date: Date) {
    try {
      const response = await api.fetchMeals(date.toISOString());

      if (response.ok) {
        const data = await response.json();
        const mealsByType = data.meals || {}; // Expected: { "Breakfast": [...], "Lunch": [...], etc. }

        // Clear existing meals
        setBreakfastMeals(new Map());
        setLunchMeals(new Map());
        setDinnerMeals(new Map());
        setBrunchMeals(new Map());

        // Populate Maps for each meal type
        Object.keys(mealsByType).forEach((mealType) => {
          const meals = mealsByType[mealType] || [];
          const mealMap = new Map<string, MealData>();

          meals.forEach((meal: any) => {
            // Ensure entrees have the correct structure with servingSize
            const processedEntrees = Array.isArray(meal.entrees) 
              ? meal.entrees.map((e: any) => ({
                  id: typeof e === 'object' ? e.id : e,
                  entree: typeof e === 'object' ? (e.entree || e.name || '') : String(e),
                  servingSize: typeof e === 'object' && e.servingSize !== undefined ? e.servingSize : 1,
                }))
              : [];
            
            const mealData: MealData = {
              id: meal.id,
              mealName: meal.mealName,
              mealDescription: meal.mealDescription || "",
              mealType: meal.meal,
              date: new Date(meal.date),
              diningHall: meal.diningHall,
              servingSize: meal.servingSize,
              entrees: processedEntrees,
              totalCalories: meal.totalCalories,
              totalProtein: meal.totalProtein,
              totalCarbs: meal.totalCarbs,
              totalFats: meal.totalFats,
            };
            mealMap.set(meal.mealName, mealData);
          });

          // Update the appropriate Map based on meal type
          switch (mealType) {
            case "Breakfast":
              setBreakfastMeals(mealMap);
              break;
            case "Lunch":
              setLunchMeals(mealMap);
              break;
            case "Dinner":
              setDinnerMeals(mealMap);
              break;
            case "Brunch":
              setBrunchMeals(mealMap);
              break;
          }
        });
      } else {
        const errorData = await response.json();
        console.error("Failed to fetch meals:", errorData.error);
      }
    } catch (err: any) {
      console.error("Error fetching meals:", err);
    }
  }

  // Fetch meals whenever selectedDate changes
  useEffect(() => {
    fetchMeals(selectedDate);
  }, [selectedDate]);

  // Reset to effective date and refetch data when page comes into focus
  useFocusEffect(
    useCallback(() => {
      const effectiveDate = getEffectiveDate();
      
      // If no effective date (3-4:30 AM EST window), use today for viewing but no add/edit access
      const dateToUse = effectiveDate || new Date();
      dateToUse.setHours(0, 0, 0, 0);
      
      // Reset selected date
      setSelectedDate(dateToUse);
      
      // Recalculate week start for current week
      const day = dateToUse.getDay();
      const monday = new Date(dateToUse);
      monday.setDate(dateToUse.getDate() - day + (day === 0 ? -6 : 1)); // Adjust to Monday
      monday.setHours(0, 0, 0, 0);
      setCurrentWeekStart(monday);
      
      // Refetch meals for the date
      fetchMeals(dateToUse);
    }, [])
  );

  // Helper function to get week dates (Monday through Sunday)
  function getWeekDates(weekStart: Date): Date[] {
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      dates.push(date);
    }
    return dates;
  }

  // Helper function to get day name
  function getDayName(date: Date): string {
    const days = ["Sun", "Mon", "Tu", "Wed", "Thur", "Fri", "Sat"];
    return days[date.getDay()];
  }

  // Helper function to get date as "11/24"
  function getDateString(date: Date): string {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
  }

  // Get array of week dates
  const weekDates = getWeekDates(currentWeekStart);

  // Navigation functions for swipe gestures
  const goToPreviousWeek = useCallback(() => {
    setCurrentWeekStart((prev) => {
      const newWeekStart = new Date(prev);
      newWeekStart.setDate(prev.getDate() - 7);
      return newWeekStart;
    });
    setSelectedDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() - 7);
      return newDate;
    });
  }, []);

  const goToNextWeek = useCallback(() => {
    setCurrentWeekStart((prev) => {
      const newWeekStart = new Date(prev);
      newWeekStart.setDate(prev.getDate() + 7);
      return newWeekStart;
    });
    setSelectedDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + 7);
      return newDate;
    });
  }, []);

  // Swipe gesture for week navigation (like Google Calendar)
  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-20, 20]) // Only activate for horizontal swipes
    .onEnd((event) => {
      'worklet';
      const swipeThreshold = 50;
      if (event.translationX > swipeThreshold) {
        // Swipe right - go to previous week
        runOnJS(goToPreviousWeek)();
      } else if (event.translationX < -swipeThreshold) {
        // Swipe left - go to next week
        runOnJS(goToNextWeek)();
      }
    });

  // Helper function to get the appropriate meal Map
  function getMealMap(mealType: string): Map<string, MealData> {
    switch (mealType) {
      case "Breakfast":
        return breakfastMeals;
      case "Lunch":
        return lunchMeals;
      case "Dinner":
        return dinnerMeals;
      case "Brunch":
        return brunchMeals;
      default:
        return new Map();
    }
  }

  // Helper function to set the appropriate meal Map
  function setMealMap(mealType: string, map: Map<string, MealData>) {
    switch (mealType) {
      case "Breakfast":
        setBreakfastMeals(new Map(map));
        break;
      case "Lunch":
        setLunchMeals(new Map(map));
        break;
      case "Dinner":
        setDinnerMeals(new Map(map));
        break;
      case "Brunch":
        setBrunchMeals(new Map(map));
        break;
    }
  }

  // Handle opening modal for a specific meal type
  function handleAddMeal(mealType: string) {
    setEditingMeal(null);
    setModalMealType(mealType);
    setModalVisible(true);
  }

  // Handle opening modal for editing a meal
  function handleEditMeal(meal: MealData) {
    setEditingMeal(meal);
    setModalMealType(meal.mealType);
    setMealName(meal.mealName);
    setMealDescription(meal.mealDescription || "");
    setDiningHall(meal.diningHall);
    
    // Populate selectedEntrees with meal's entrees
    const entreesMap = new Map<number, number>();
    meal.entrees.forEach((entree) => {
      entreesMap.set(entree.id, entree.servingSize);
    });

    setModalVisible(true);

    setSelectedEntrees(entreesMap);
  }

  // Get available meal types for today based on day of week
  function getAvailableMealTypes(): string[] {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Weekends: Saturday (6) or Sunday (0)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return ["Brunch", "Dinner"];
    }
    
    // Weekdays: Monday (1) through Friday (5)
    return ["Breakfast", "Lunch", "Dinner"];
  }

  // Handle opening copy modal for a meal
  async function handleCopyMeal(meal: MealData) {
    const effectiveDate = getEffectiveDate();
    const mealDate = new Date(meal.date);
    mealDate.setHours(0, 0, 0, 0);
    const isEffectiveDate = effectiveDate ? mealDate.getTime() === effectiveDate.getTime() : false;
    
    setMealToCopy(meal);
    setSelectedCopyMealType(""); // Reset selection
    setCopyError(null);
    
    // Get available meal types, excluding the current meal's type if copying from effective date
    const allAvailableTypes = getAvailableMealTypes();
    const availableTypes = isEffectiveDate 
      ? allAvailableTypes.filter(type => type !== meal.mealType) // Exclude current meal type
      : allAvailableTypes; // Can copy to any meal type if from past
    
    setAvailableMealTypes(availableTypes);
    setCopyModalVisible(true);
  }

  // Verify entrees for selected meal type (by name)
  async function verifyEntreesForMealType(mealType: string) {
    if (!mealToCopy || !mealType) return;

    setVerifyingCopy(true);
    setCopyError(null);

    try {
      const entreeNames = mealToCopy.entrees.map(e => e.entree);
      const response = await api.verifyEntrees(entreeNames, mealType, mealToCopy.diningHall);

      const data = await response.json();

      if (!data.valid) {
        setCopyError(
          `Cannot copy to ${mealType}: The following items are not available:\n${data.missingNames.join(', ')}`
        );
      }
    } catch (error) {
      console.error("Error verifying entrees:", error);
      setCopyError("Failed to verify meal items. Please try again.");
    } finally {
      setVerifyingCopy(false);
    }
  }

  // Handle confirming the copy
  async function handleConfirmCopy() {
    if (!mealToCopy || copyError || !selectedCopyMealType) return;

    try {
      setCopyingMeal(true);

      // Determine target date: effective date if meal is from past, same date if from effective date
      const effectiveDate = getEffectiveDate();
      if (!effectiveDate) {
        setCopyError("Cannot copy meals during 3-4:30 AM EST window. Please try again after 4:30 AM EST.");
        setCopyingMeal(false);
        return;
      }
      
      const mealDate = new Date(mealToCopy.date);
      mealDate.setHours(0, 0, 0, 0);
      const isEffectiveDate = mealDate.getTime() === effectiveDate.getTime();
      const targetDate = isEffectiveDate ? mealDate : effectiveDate; // Same day if copying from effective date, effective date if from past

      // Look up current entree IDs by name for the selected meal type and dining hall
      const entreeNames = mealToCopy.entrees.map(e => e.entree);
      const lookupResponse = await api.getEntreesByNames(entreeNames, selectedCopyMealType, mealToCopy.diningHall);

      if (!lookupResponse.ok) {
        setCopyError("Failed to look up current menu items");
        setCopyingMeal(false);
        return;
      }

      const lookupData = await lookupResponse.json();
      
      // Map entree names to their current IDs and serving sizes
      const entrees: Array<{ id: number; servingSize: number }> = [];
      const missingEntrees: string[] = [];
      
      for (const originalEntree of mealToCopy.entrees) {
        const currentEntree = lookupData.entrees.find((e: any) => e.entree === originalEntree.entree);
        if (!currentEntree) {
          missingEntrees.push(originalEntree.entree);
        } else {
          entrees.push({
            id: currentEntree.id,
            servingSize: originalEntree.servingSize || 1,
          });
        }
      }

      if (missingEntrees.length > 0) {
        setCopyError(`Some items are no longer available: ${missingEntrees.join(', ')}`);
        setCopyingMeal(false);
        return;
      }

      // Copy with selected meal type
      const response = await api.addMeal({
        mealName: mealToCopy.mealName,
        mealDescription: mealToCopy.mealDescription,
        mealType: selectedCopyMealType, // Use selected meal type, not original
        date: targetDate.toISOString(),
        diningHall: mealToCopy.diningHall,
        entrees: entrees,
        servingSize: mealToCopy.servingSize,
      });

      if (response.ok) {
        // Close modal and refresh
        setCopyModalVisible(false);
        setMealToCopy(null);
        setSelectedCopyMealType("");
        setCopyError(null);
        
        // Refresh meals if viewing the target date
        const targetDateStart = new Date(targetDate);
        targetDateStart.setHours(0, 0, 0, 0);
        const selectedStart = new Date(selectedDate);
        selectedStart.setHours(0, 0, 0, 0);
        
        if (targetDateStart.getTime() === selectedStart.getTime()) {
          fetchMeals(selectedDate);
        }
      } else {
        const data = await response.json();
        setCopyError(data.error || "Failed to copy meal");
      }
    } catch (error) {
      console.error("Error copying meal:", error);
      setCopyError("Network error. Please try again.");
    } finally {
      setCopyingMeal(false);
    }
  }

  // Handle removing a meal from the appropriate hashmap and backend
  async function handleRemoveMeal(mealType: string, mealId: number, mealName: string) {
    try {
      console.log("Attempting to remove meal:", { mealId, mealName, mealType });

      const response = await api.removeMeal(mealId);

      console.log("Remove meal response status:", response.status);

      if (response.ok) {
        const result = await response.json();
        console.log("Meal removed successfully:", result);
        // Remove from hashmap only if backend deletion succeeds
        const mealMap = getMealMap(mealType);
        const newMap = new Map(mealMap);
        newMap.delete(mealName);
        setMealMap(mealType, newMap);
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("Failed to remove meal:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData.error || errorData,
        });
        Alert.alert("Error", errorData.error || "Failed to remove meal. Please try again.");
      }
    } catch (err: any) {
      console.error("Error removing meal:", err);
      Alert.alert("Error", "Something went wrong. Please check your connection and try again.");
    }
  }

  // Handle increasing serving size
  async function handleIncreaseServing(mealType: string, mealId: number, mealName: string) {
    try {
      const response = await api.increaseServing(mealId);

      if (response.ok) {
        const result = await response.json();
        const updatedMeal = result.meal;
        
        // Update meal in hashmap with new serving size
        const mealMap = getMealMap(mealType);
        const meal = mealMap.get(mealName);
        if (meal) {
          const updatedMealData: MealData = {
            ...meal,
            servingSize: updatedMeal.servingSize,
          };
          const newMap = new Map(mealMap);
          newMap.set(mealName, updatedMealData);
          setMealMap(mealType, newMap);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("Failed to increase serving size:", {
          status: response.status,
          error: errorData.error || errorData,
        });
        Alert.alert("Error", errorData.error || "Failed to update serving size. Please try again.");
      }
    } catch (err: any) {
      console.error("Error increasing serving size:", err);
      Alert.alert("Error", "Something went wrong. Please check your connection and try again.");
    }
  }

  // Handle decreasing serving size
  async function handleDecreaseServing(mealType: string, mealId: number, mealName: string) {
    // Get current meal to check serving size
    const mealMap = getMealMap(mealType);
    const meal = mealMap.get(mealName);
    
    // If serving size is 1, remove the meal instead
    if (meal && meal.servingSize === 1) {
      await handleRemoveMeal(mealType, mealId, mealName);
      return;
    }

    try {
      const response = await api.decreaseServing(mealId);

      if (response.ok) {
        const result = await response.json();
        const updatedMeal = result.meal;
        
        // Update meal in hashmap with new serving size
        const updatedMealData: MealData = {
          ...meal!,
          servingSize: updatedMeal.servingSize,
        };
        const newMap = new Map(mealMap);
        newMap.set(mealName, updatedMealData);
        setMealMap(mealType, newMap);
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("Failed to decrease serving size:", {
          status: response.status,
          error: errorData.error || errorData,
        });
        Alert.alert("Error", errorData.error || "Failed to update serving size. Please try again.");
      }
    } catch (err: any) {
      console.error("Error decreasing serving size:", err);
      Alert.alert("Error", "Something went wrong. Please check your connection and try again.");
    }
  }

  // Fetch entrees from API
  async function fetchEntrees() {
    if (!diningHall || !modalMealType) return;

    setFetchingEntrees(true);
    try {
      const response = await api.fetchAllEntrees(diningHall, modalMealType);

      if (response.ok) {
        const data = await response.json();
        setEntreeOptions(data.entrees || []);
      } else {
        const errorData = await response.json();
        console.error("Failed to fetch entrees:", errorData.error);
      }
    } catch (err: any) {
      console.error("Error fetching entrees:", err);
    } finally {
      setFetchingEntrees(false);
    }
  }

  // Fetch entrees when dining hall changes
  useEffect(() => {
    if (modalVisible && diningHall && modalMealType) {
      fetchEntrees();

      if (editingMeal === null || editingMeal.diningHall !== diningHall) {
        setSelectedEntrees(new Map());
      }
      setEntreeSearchQuery("");
    }
  }, [diningHall, modalMealType, modalVisible, editingMeal]);

  // Handle closing modal
  function handleCloseModal() {
    setModalVisible(false);
    setEditingMeal(null);
    setMealName("");
    setMealDescription("");
    setDiningHall("");
    setSelectedEntrees(new Map());
    setEntreeOptions([]);
    setEntreeSearchQuery("");
  }

  // Toggle entree selection (default serving size is 1)
  function toggleEntreeSelection(entreeId: number) {
    const newMap = new Map(selectedEntrees);
    if (newMap.has(entreeId)) {
      newMap.delete(entreeId);
    } else {
      newMap.set(entreeId, 1); // Default serving size is 1
    }
    setSelectedEntrees(newMap);
  }

  // Update serving size for an entree
  function updateServingSize(entreeId: number, servingSize: number) {
    if (servingSize < 0.5) return; // Minimum serving size
    const newMap = new Map(selectedEntrees);
    newMap.set(entreeId, servingSize);
    setSelectedEntrees(newMap);
  }

  // Filter entrees based on search query (memoized)
  const filteredEntrees = useMemo(() => {
    if (!entreeSearchQuery.trim()) {
      return entreeOptions;
    }
    const query = entreeSearchQuery.toLowerCase().trim();
    return entreeOptions.filter((entree) =>
      entree.entree.toLowerCase().includes(query)
    );
  }, [entreeOptions, entreeSearchQuery]);

  // Handle form submit (both add and edit)
  async function handleSubmitMeal() {
    // Validation
    if (!mealName.trim()) {
      console.error("Meal name is required");
      return;
    }

    if (!diningHall) {
      console.error("Dining hall is required");
      return;
    }

    if (selectedEntrees.size === 0) {
      console.error("At least one entree must be selected");
      return;
    }

    try {
      // Convert selectedEntrees Map to array of objects with id and servingSize
      const entrees = Array.from(selectedEntrees.entries()).map(([entreeId, servingSize]) => ({
        id: entreeId,
        servingSize: servingSize,
      }));

      // Calculate total macros based on entrees and serving sizes (for display)
      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFats = 0;

      selectedEntrees.forEach((servingSize, entreeId) => {
        const entree = entreeOptions.find((opt) => opt.id === entreeId);
        if (entree) {
          totalCalories += entree.totalCalories * servingSize;
          totalProtein += entree.protein * servingSize;
          totalCarbs += entree.totalCarbohydrate * servingSize;
          totalFats += entree.totalFat * servingSize;
        }
      });

      // Convert entreesData to Entree[] format
      const entreesData = Array.from(selectedEntrees.entries())
        .map(([entreeId, servingSize]) => {
          const entree = entreeOptions.find((opt) => opt.id === entreeId);
          return entree ? { id: entree.id, entree: entree.entree, servingSize } : null;
        })
        .filter((entree): entree is { id: number; entree: string; servingSize: number } => entree !== null);

      const entreesWithNames: Entree[] = entreesData.map((entree) => ({
        id: entree.id,
        entree: entree.entree,
        servingSize: entree.servingSize,
      }));

      if (editingMeal) {
        // EDIT MODE: Update existing meal
        // Check if meal is on accessible date
        if (!isDateAccessible(editingMeal.date)) {
          Alert.alert("Error", "This meal can no longer be edited.");
          return;
        }

        const response = await api.updateMeal({
          mealId: editingMeal.id,
          mealName: mealName.trim(),
          mealDescription: mealDescription.trim() || "",
          entrees: entrees,
        });

        if (response.ok) {
          const result = await response.json();
          const meal = result.meal;

          // Create updated MealData object
          const updatedMeal: MealData = {
            id: editingMeal.id, // Preserve original ID
            mealName: meal.mealName,
            mealDescription: meal.mealDescription || "",
            mealType: meal.meal,
            date: new Date(meal.date),
            diningHall: meal.diningHall,
            servingSize: meal.servingSize, // Preserve serving size
            entrees: entreesWithNames, // Use local entrees array with names
            totalCalories: totalCalories, // Use our calculated values
            totalProtein: totalProtein,
            totalCarbs: totalCarbs,
            totalFats: totalFats,
          };

          // Update meal in the appropriate Map
          const mealMap = getMealMap(modalMealType);
          const newMap = new Map(mealMap);
          // Remove old entry and add updated one (in case meal name changed)
          if (editingMeal.mealName !== updatedMeal.mealName) {
            newMap.delete(editingMeal.mealName);
          }
          newMap.set(updatedMeal.mealName, updatedMeal);
          setMealMap(modalMealType, newMap);

          // Close modal
          handleCloseModal();
        } else {
          const errorData = await response.json();
          console.error("Failed to update meal:", errorData.error);
          Alert.alert("Error", errorData.error || "Failed to update meal. Please try again.");
        }
      } else {
        // ADD MODE: Create new meal
        // Always use effective date when adding meals
        const effectiveDate = getEffectiveDate();
        
        if (!effectiveDate) {
          Alert.alert("Error", "Cannot add meals during 3-4:30 AM EST window. Please try again after 4:30 AM EST.");
          return;
        }
        
        const response = await api.addMeal({
          mealName: mealName.trim(),
          mealDescription: mealDescription.trim() || "",
          mealType: modalMealType,
          date: effectiveDate.toISOString(),
          diningHall: diningHall,
          entrees: entrees,
          servingSize: 1,
        });

        if (response.ok) {
          const result = await response.json();
          const meal = result.meal;

          // Create MealData object with API response
          const newMeal: MealData = {
            id: meal.id,
            mealName: meal.mealName,
            mealDescription: meal.mealDescription || "",
            mealType: meal.meal,
            date: new Date(meal.date),
            diningHall: meal.diningHall,
            servingSize: meal.servingSize,
            entrees: entreesWithNames, // Use local entrees array with names
            totalCalories: totalCalories, // Use our calculated values
            totalProtein: totalProtein,
            totalCarbs: totalCarbs,
            totalFats: totalFats,
          };

          // Add meal to the appropriate Map
          const mealMap = getMealMap(modalMealType);
          mealMap.set(newMeal.mealName, newMeal);
          setMealMap(modalMealType, mealMap);

          // Close modal
          handleCloseModal();
        } else {
          const errorData = await response.json();
          console.error("Failed to add meal:", errorData.error);
          Alert.alert("Error", errorData.error || "Failed to add meal. Please try again.");
        }
      }
    } catch (err: any) {
      console.error("Error submitting meal:", err);
      Alert.alert("Error", "Something went wrong. Please check your connection and try again.");
    }
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <ScrollView 
        className="flex-1"
        showsVerticalScrollIndicator={true}
        indicatorStyle="black"
      >
        {/* Date Selector - Swipe left/right to change week */}
        <GestureDetector gesture={swipeGesture}>
          <View className="bg-white px-3 py-4">
            <View className="flex-row items-center justify-between">
              {weekDates.map((date, index) => {
                const isSelected = date.toDateString() === selectedDate.toDateString();
                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => setSelectedDate(date)}
                    className={`items-center py-3 px-3 rounded-xl ${
                      isSelected ? "bg-blue-600" : "bg-transparent"
                    }`}
                    activeOpacity={0.7}
                  >
                    <Text
                      className={`text-sm font-semibold mb-1 ${
                        isSelected ? "text-white" : "text-gray-600"
                      }`}
                    >
                      {getDayName(date)}
                    </Text>
                    <Text
                      className={`text-sm font-medium ${
                        isSelected ? "text-white" : "text-gray-500"
                      }`}
                    >
                      {getDateString(date)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </GestureDetector>

        {/* Meal Sections */}
        <View className="px-4 py-6">
          {/* Breakfast Header */}
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-2xl font-bold text-gray-900">Breakfast</Text>
            {isDateAccessible(selectedDate) && (
              <TouchableOpacity
                onPress={() => handleAddMeal("Breakfast")}
                className="w-12 h-12 bg-blue-600 rounded-full items-center justify-center shadow-md"
                activeOpacity={0.8}
              >
                <Text className="text-white text-2xl font-bold">+</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Breakfast Meal Cards */}
          {breakfastMeals.size === 0 ? (
            <View className="bg-gray-50 rounded-xl p-4 mb-4 border border-dashed border-gray-300">
              <View className="flex-row items-center">
                <Text className="text-gray-400 mr-2">✨</Text>
                <Text className="text-gray-500 text-sm italic">
                  No meals logged yet. Tap the + button to add one.
                </Text>
              </View>
            </View>
          ) : (
            <View className="gap-4 mb-6">
              {Array.from(breakfastMeals.values()).map((meal) => (
                <MealCard
                  key={meal.id}
                  mealName={meal.mealName}
                  mealDescription={meal.mealDescription}
                  totalCalories={meal.totalCalories}
                  totalProtein={meal.totalProtein}
                  entrees={meal.entrees}
                  servingSize={meal.servingSize}
                  isEditable={isDateAccessible(meal.date)}
                  onEdit={() => handleEditMeal(meal)}
                  onCopy={() => handleCopyMeal(meal)}
                  onRemove={() => handleRemoveMeal("Breakfast", meal.id, meal.mealName)}
                  onIncreaseServing={() => handleIncreaseServing("Breakfast", meal.id, meal.mealName)}
                  onDecreaseServing={() => handleDecreaseServing("Breakfast", meal.id, meal.mealName)}
                />
              ))}
            </View>
          )}

          {/* Lunch Header */}
          <View className="flex-row items-center justify-between mb-4 mt-8">
            <Text className="text-2xl font-bold text-gray-900">Lunch</Text>
            {isDateAccessible(selectedDate) && (
              <TouchableOpacity
                onPress={() => handleAddMeal("Lunch")}
                className="w-12 h-12 bg-blue-600 rounded-full items-center justify-center shadow-md"
                activeOpacity={0.8}
              >
                <Text className="text-white text-2xl font-bold">+</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Lunch Meal Cards */}
          {lunchMeals.size === 0 ? (
            <View className="bg-gray-50 rounded-xl p-4 mb-4 border border-dashed border-gray-300">
              <View className="flex-row items-center">
                <Text className="text-gray-400 mr-2">✨</Text>
                <Text className="text-gray-500 text-sm italic">
                  No meals logged yet. Tap the + button to add one.
                </Text>
              </View>
            </View>
          ) : (
            <View className="gap-4 mb-6">
              {Array.from(lunchMeals.values()).map((meal) => (
                <MealCard
                  key={meal.id}
                  mealName={meal.mealName}
                  mealDescription={meal.mealDescription}
                  totalCalories={meal.totalCalories}
                  totalProtein={meal.totalProtein}
                  entrees={meal.entrees}
                  servingSize={meal.servingSize}
                  isEditable={isDateAccessible(meal.date)}
                  onEdit={() => handleEditMeal(meal)}
                  onCopy={() => handleCopyMeal(meal)}
                  onRemove={() => handleRemoveMeal("Lunch", meal.id, meal.mealName)}
                  onIncreaseServing={() => handleIncreaseServing("Lunch", meal.id, meal.mealName)}
                  onDecreaseServing={() => handleDecreaseServing("Lunch", meal.id, meal.mealName)}
                />
              ))}
            </View>
          )}

          {/* Dinner Header */}
          <View className="flex-row items-center justify-between mb-4 mt-8">
            <Text className="text-2xl font-bold text-gray-900">Dinner</Text>
            {isDateAccessible(selectedDate) && (
              <TouchableOpacity
                onPress={() => handleAddMeal("Dinner")}
                className="w-12 h-12 bg-blue-600 rounded-full items-center justify-center shadow-md"
                activeOpacity={0.8}
              >
                <Text className="text-white text-2xl font-bold">+</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Dinner Meal Cards */}
          {dinnerMeals.size === 0 ? (
            <View className="bg-gray-50 rounded-xl p-4 mb-4 border border-dashed border-gray-300">
              <View className="flex-row items-center">
                <Text className="text-gray-400 mr-2">✨</Text>
                <Text className="text-gray-500 text-sm italic">
                  No meals logged yet. Tap the + button to add one.
                </Text>
              </View>
            </View>
          ) : (
            <View className="gap-4 mb-6">
              {Array.from(dinnerMeals.values()).map((meal) => (
                <MealCard
                  key={meal.id}
                  mealName={meal.mealName}
                  mealDescription={meal.mealDescription}
                  totalCalories={meal.totalCalories}
                  totalProtein={meal.totalProtein}
                  entrees={meal.entrees}
                  servingSize={meal.servingSize}
                  isEditable={isDateAccessible(meal.date)}
                  onEdit={() => handleEditMeal(meal)}
                  onCopy={() => handleCopyMeal(meal)}
                  onRemove={() => handleRemoveMeal("Dinner", meal.id, meal.mealName)}
                  onIncreaseServing={() => handleIncreaseServing("Dinner", meal.id, meal.mealName)}
                  onDecreaseServing={() => handleDecreaseServing("Dinner", meal.id, meal.mealName)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Meal Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseModal}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View className="flex-1 bg-black/50 items-center justify-center px-4">
            <View className="bg-white rounded-2xl w-full max-w-md p-6" style={{ maxHeight: '90%' }}>
              <ScrollView 
                showsVerticalScrollIndicator={true}
                indicatorStyle="black"
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 20 }}
                nestedScrollEnabled={true}
              >
              {/* Header */}
              <View className="flex-row items-center justify-between mb-6">
                <Text className="text-2xl font-bold text-gray-900">
                  {editingMeal ? `Update ${modalMealType}` : `Add ${modalMealType}`}
                </Text>
                <TouchableOpacity onPress={handleCloseModal} activeOpacity={0.7}>
                  <Text className="text-2xl text-gray-500">✕</Text>
                </TouchableOpacity>
              </View>

              {/* Meal Name */}
              <View className="mb-4">
                <Text className="text-base font-semibold text-gray-700 mb-2">Meal Name *</Text>
                <TextInput
                  className="h-12 px-4 text-base bg-gray-50 border border-gray-200 rounded-xl"
                  placeholder="Enter meal name"
                  value={mealName}
                  onChangeText={setMealName}
                />
              </View>

              {/* Meal Description */}
              <View className="mb-4">
                <Text className="text-base font-semibold text-gray-700 mb-2">Description (Optional)</Text>
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
                <Text className="text-base font-semibold text-gray-700 mb-2">Dining Hall *</Text>
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
                        {hall}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Entrees Selection */}
              <View className="mb-4">
                <Text className="text-base font-semibold text-gray-700 mb-2">Select Entrees *</Text>
                {!diningHall ? (
                  <Text className="text-gray-500 text-sm">Please select a dining hall first</Text>
                ) : fetchingEntrees ? (
                  <View className="items-center py-4">
                    <ActivityIndicator size="small" color="#2563eb" />
                    <Text className="text-gray-500 text-sm mt-2">Loading entrees...</Text>
                  </View>
                ) : entreeOptions.length === 0 ? (
                  <Text className="text-gray-500 text-sm">No entrees available for this dining hall</Text>
                ) : (
                  <View>
                    {/* Search Bar */}
                    <TextInput
                      className="h-10 px-4 mb-3 text-base bg-gray-50 border border-gray-200 rounded-xl"
                      placeholder="Search entrees..."
                      value={entreeSearchQuery}
                      onChangeText={setEntreeSearchQuery}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    
                    {/* Entrees List */}
                    <View className="max-h-48 border border-gray-200 rounded-xl p-2">
                      <ScrollView 
                        nestedScrollEnabled={true}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={true}
                        indicatorStyle="black"
                      >
                        {filteredEntrees.length === 0 ? (
                          <Text className="text-gray-500 text-sm text-center py-4">
                            No entrees found matching "{entreeSearchQuery}"
                          </Text>
                        ) : (
                          filteredEntrees.map((entree) => {
                            const isSelected = selectedEntrees.has(entree.id);
                            const servingSize = selectedEntrees.get(entree.id) || 1;
                            return (
                              <View key={entree.id} className="mb-2">
                                <TouchableOpacity
                                  onPress={() => toggleEntreeSelection(entree.id)}
                                  className={`p-3 rounded-lg border-2 ${
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
                                {isSelected && (
                                  <View className="flex-row items-center justify-between mt-2 px-3">
                                    <Text className="text-xs text-gray-600">Serving Size:</Text>
                                    <View className="flex-row items-center gap-3">
                                      <TouchableOpacity
                                        onPress={() => updateServingSize(entree.id, Math.max(0.5, servingSize - 0.5))}
                                        className="w-8 h-8 bg-gray-200 rounded-full items-center justify-center"
                                        activeOpacity={0.7}
                                      >
                                        <Text className="text-gray-700 font-bold">−</Text>
                                      </TouchableOpacity>
                                      <TextInput
                                        className="w-12 h-8 px-2 text-center text-sm bg-white border border-gray-300 rounded"
                                        value={servingSize.toString()}
                                        onChangeText={(text) => {
                                          const value = parseFloat(text);
                                          if (!isNaN(value) && value >= 0.5) {
                                            updateServingSize(entree.id, value);
                                          }
                                        }}
                                        keyboardType="numeric"
                                      />
                                      <TouchableOpacity
                                        onPress={() => updateServingSize(entree.id, servingSize + 0.5)}
                                        className="w-8 h-8 bg-gray-200 rounded-full items-center justify-center"
                                        activeOpacity={0.7}
                                      >
                                        <Text className="text-gray-700 font-bold">+</Text>
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                )}
                              </View>
                            );
                          })
                        )}
                      </ScrollView>
                    </View>
                    
                    {/* Selected count */}
                    {selectedEntrees.size > 0 && (
                      <Text className="text-xs text-gray-500 mt-2">
                        {selectedEntrees.size} entree{selectedEntrees.size !== 1 ? 's' : ''} selected
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleSubmitMeal}
                className="w-full bg-blue-600 py-4 rounded-xl items-center mt-2"
                activeOpacity={0.8}
              >
                <Text className="text-white text-lg font-semibold">
                  {editingMeal ? "Update Meal" : "Add Meal"}
                </Text>
              </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Copy Meal Modal */}
      <Modal
        visible={copyModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setCopyModalVisible(false);
          setMealToCopy(null);
          setSelectedCopyMealType("");
          setCopyError(null);
        }}
      >
        <View className="flex-1 bg-black/50 items-center justify-center px-4">
          <View className="bg-white rounded-2xl w-full max-w-md p-6">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-2xl font-bold text-gray-900">
                {(() => {
                  const effectiveDate = getEffectiveDate();
                  if (!effectiveDate) return "Copy Meal";
                  const mealDate = new Date(mealToCopy?.date || new Date());
                  mealDate.setHours(0, 0, 0, 0);
                  return mealDate.getTime() === effectiveDate.getTime() ? "Copy to Another Meal" : "Copy to Current Day";
                })()}
              </Text>
              <TouchableOpacity 
                onPress={() => {
                  setCopyModalVisible(false);
                  setMealToCopy(null);
                  setSelectedCopyMealType("");
                  setCopyError(null);
                }} 
                activeOpacity={0.7}
              >
                <Text className="text-2xl text-gray-500">✕</Text>
              </TouchableOpacity>
            </View>

            {/* Meal Info */}
            {mealToCopy && (
              <View className="bg-gray-50 p-4 rounded-xl mb-4">
                <Text className="text-lg font-semibold text-gray-900">{mealToCopy.mealName}</Text>
                <Text className="text-sm text-gray-600 mt-1">{mealToCopy.mealType} • {mealToCopy.diningHall}</Text>
                <Text className="text-xs text-gray-500 mt-2">
                  {mealToCopy.entrees.length} item{mealToCopy.entrees.length !== 1 ? 's' : ''}
                </Text>
              </View>
            )}

            {/* Verifying State */}
            {verifyingCopy && (
              <View className="items-center py-4">
                <ActivityIndicator size="small" color="#2563eb" />
                <Text className="text-gray-600 mt-2">Verifying meal items...</Text>
              </View>
            )}

            {/* Error Message */}
            {copyError && !verifyingCopy && (
              <View className="bg-red-50 border border-red-200 p-4 rounded-xl mb-4">
                <Text className="text-red-700 text-sm">{copyError}</Text>
              </View>
            )}

            {/* Meal Type Selection */}
            {!verifyingCopy && (
              <>
                {/* Meal Type Selection */}
                <View className="mb-4">
                  <Text className="text-base font-semibold text-gray-700 mb-3">Copy to which meal type?</Text>
                  <View className={`flex-row gap-2 ${availableMealTypes.length === 2 ? 'justify-center' : ''}`}>
                    {availableMealTypes.map((mealType) => (
                      <TouchableOpacity
                        key={mealType}
                        onPress={() => {
                          setSelectedCopyMealType(mealType);
                          verifyEntreesForMealType(mealType);
                        }}
                        className={`${availableMealTypes.length === 2 ? 'flex-1' : 'flex-1'} py-3 px-4 rounded-xl border-2 ${
                          selectedCopyMealType === mealType
                            ? "bg-blue-600 border-blue-600"
                            : "bg-white border-gray-300"
                        }`}
                        activeOpacity={0.7}
                      >
                        <Text
                          className={`text-sm font-semibold text-center ${
                            selectedCopyMealType === mealType ? "text-white" : "text-gray-700"
                          }`}
                        >
                          {mealType}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Success/Error Message after meal type selection */}
                {selectedCopyMealType && !verifyingCopy && !copyError && (
                  <View className="bg-green-50 border border-green-200 p-4 rounded-xl mb-4">
                    <Text className="text-green-700 text-sm">✓ All items are available for {selectedCopyMealType}. Ready to copy!</Text>
                  </View>
                )}
              </>
            )}

            {/* Copy Button */}
            <TouchableOpacity
              onPress={handleConfirmCopy}
              disabled={verifyingCopy || !!copyError || copyingMeal || !selectedCopyMealType}
              className={`w-full py-4 rounded-xl items-center ${
                verifyingCopy || copyError || copyingMeal || !selectedCopyMealType
                  ? "bg-gray-300"
                  : "bg-blue-600"
              }`}
              activeOpacity={0.8}
            >
              {copyingMeal ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text className={`text-lg font-semibold ${
                  verifyingCopy || copyError || !selectedCopyMealType ? "text-gray-500" : "text-white"
                }`}>
                  {selectedCopyMealType 
                    ? (() => {
                        const effectiveDate = getEffectiveDate();
                        if (!effectiveDate) return "Not Available (3-4:30 AM EST)";
                        const mealDate = new Date(mealToCopy?.date || new Date());
                        mealDate.setHours(0, 0, 0, 0);
                        const isEffectiveDate = mealDate.getTime() === effectiveDate.getTime();
                        return isEffectiveDate 
                          ? `Copy to ${selectedCopyMealType}` 
                          : `Copy to Current Day's ${selectedCopyMealType}`;
                      })()
                    : "Select Meal Type"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}