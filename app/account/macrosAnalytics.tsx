// app/account/macrosAnalytics.tsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, ActivityIndicator, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import '../../global.css';

// Stat Card Component
interface StatCardProps {
  label: string;
  value: number;
  unit?: string;
  dotColor: string;
  bgColor: string;
}

function StatCard({ label, value, unit, dotColor, bgColor }: StatCardProps) {
  return (
    <View 
      className="flex-1 rounded-2xl p-4 border border-gray-100"
      style={{ backgroundColor: bgColor }}
    >
      <View className="flex-row items-center mb-2">
        <View 
          className="w-2.5 h-2.5 rounded-full mr-2"
          style={{ backgroundColor: dotColor }}
        />
        <Text className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          {label}
        </Text>
      </View>
      <Text className="text-3xl font-bold text-gray-900 mb-1">
        {Math.round(value)}{unit}
      </Text>
      <Text className="text-sm text-gray-500">This week</Text>
    </View>
  );
}

// Bar Chart Component
interface BarChartProps {
  title: string;
  subtitle: string;
  data: number[];
  unit: string;
  dotColor: string;
  maxValue?: number;
}

function BarChart({ title, subtitle, data, unit, dotColor, maxValue }: BarChartProps) {
  // State to track which bar is selected (showing value)
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);

  // Calculate max value - use the larger of provided maxValue or actual data max
  const dataMax = Math.max(...data, 1);
  const chartMax = maxValue 
    ? Math.max(maxValue, dataMax) * 1.1
    : dataMax * 1.2;
  
  // Round up to nearest nice number for cleaner display
  const roundedMax = Math.ceil(chartMax / 100) * 100 || 100;
  
  // Generate Y-axis labels (4 tick marks)
  const yAxisLabels = useMemo(() => {
    const ticks = 4;
    const labels: number[] = [];
    for (let i = 0; i <= ticks; i++) {
      labels.push(Math.round((roundedMax / ticks) * i));
    }
    return labels;
  }, [roundedMax]);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const chartHeight = 220;

  return (
    <View className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100">
      {/* Header */}
      <View className="flex-row items-start justify-between mb-1">
        <View className="flex-row items-center">
          <View 
            className="w-3 h-3 rounded-full mr-2"
            style={{ backgroundColor: dotColor }}
          />
          <Text className="text-xl font-bold text-gray-900">{title}</Text>
        </View>
        <TouchableOpacity 
          className="flex-row items-center px-3 py-1.5 rounded-full border border-gray-200"
          activeOpacity={0.7}
        >
          <Text className="text-gray-400 mr-1">✨</Text>
          <Text className="text-sm text-gray-600">Weekly</Text>
        </TouchableOpacity>
      </View>
      <Text className="text-sm text-gray-500 mb-6">{subtitle}</Text>
      
      {/* Chart Container */}
      <View className="relative" style={{ height: chartHeight }}>
        {/* Y-axis Labels */}
        <View className="absolute left-0 top-0 bottom-0 w-12 items-end pr-2">
          {yAxisLabels.map((label, index) => {
            const positionPercent = (index / (yAxisLabels.length - 1)) * 100;
            return (
              <View
                key={index}
                className="absolute justify-center"
                style={{ bottom: `${positionPercent}%` }}
              >
                <Text className="text-xs text-gray-400">{label}</Text>
              </View>
            );
          })}
        </View>

        {/* Chart Area with Grid Lines */}
        <View className="ml-14 mr-2 flex-1">
          {/* Grid Lines */}
          {yAxisLabels.map((_, index) => {
            const positionPercent = (index / (yAxisLabels.length - 1)) * 100;
            return (
              <View
                key={index}
                className="absolute left-0 right-0 border-t border-gray-100"
                style={{ bottom: `${positionPercent}%` }}
              />
            );
          })}

          {/* Bars Container */}
          <View className="flex-row justify-between" style={{ height: '100%', alignItems: 'flex-end' }}>
            {data.map((value, index) => {
              const barHeightPercent = Math.min((value / roundedMax) * 100, 100);
              const isSelected = selectedBarIndex === index;
              
              return (
                <View key={index} className="flex-1 items-center mx-1" style={{ height: '100%', justifyContent: 'flex-end' }}>
                  {/* Value Tooltip */}
                  {isSelected && value > 0 && (
                    <View className="absolute items-center" style={{ width: '100%', bottom: '100%', marginBottom: 4 }}>
                      <View className="bg-gray-900 px-2 py-1 rounded">
                        <Text className="text-white text-xs font-semibold">
                          {Math.round(value)}{unit}
                        </Text>
                      </View>
                    </View>
                  )}
                  
                  {/* Bar */}
                  <TouchableOpacity
                    onPress={() => setSelectedBarIndex(isSelected ? null : index)}
                    activeOpacity={0.8}
                    style={{ width: '100%', height: `${barHeightPercent}%`, minHeight: value > 0 ? 4 : 0 }}
                  >
                    <View className="w-full h-full rounded-t-lg bg-gray-900" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* X-axis Labels */}
      <View className="flex-row justify-between mt-3 ml-14 mr-2">
        {days.map((day, index) => (
          <Text key={index} className="text-xs text-gray-400 flex-1 text-center">
            {day}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default function MacrosAnalytics() {
  // API Base URL
  const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';

  // State for selected date (used to determine which week to show)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // State arrays for weekly macros (Monday = index 0, Sunday = index 6)
  const [protein, setProtein] = useState<number[]>(new Array(7).fill(0));
  const [carbs, setCarbs] = useState<number[]>(new Array(7).fill(0));
  const [fats, setFats] = useState<number[]>(new Array(7).fill(0));
  const [calories, setCalories] = useState<number[]>(new Array(7).fill(0));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Helper function to get Monday of the week for a given date
  function getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Adjust for Sunday
    d.setDate(d.getDate() + diff);
    return d;
  }

  // Helper function to get Sunday of the week for a given date
  function getSunday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? 0 : 7 - day;
    d.setDate(d.getDate() + diff);
    return d;
  }

  // Format date as "Dec 1"
  function formatDateShort(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }

  // Get week range string (e.g., "Dec 1 - Dec 8")
  const weekRangeString = useMemo(() => {
    const monday = getMonday(selectedDate);
    const sunday = getSunday(selectedDate);
    return `${formatDateShort(monday)} - ${formatDateShort(sunday)}`;
  }, [selectedDate]);

  // Navigation functions
  function goToPreviousWeek() {
    setSelectedDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() - 7);
      return newDate;
    });
  }

  function goToNextWeek() {
    setSelectedDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + 7);
      return newDate;
    });
  }

  // Fetch weekly macros from backend
  useEffect(() => {
    async function fetchWeeklyMacros() {
      setLoading(true);
      try {
        // Get authentication token
        const token = await AsyncStorage.getItem("token");
        if (!token) {
          console.error("Not authenticated");
          setError("Not authenticated");
          setLoading(false);
          return;
        }

        // Make API call with date parameter
        const dateISO = selectedDate.toISOString();
        const response = await fetch(`${API_BASE_URL}/weekly-macros?date=${encodeURIComponent(dateISO)}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          // Initialize state variables with arrays from backend
          setProtein(data.protein || new Array(7).fill(0));
          setCalories(data.calories || new Array(7).fill(0));
          setCarbs(data.carbs || new Array(7).fill(0));
          setFats(data.fats || new Array(7).fill(0));
          setError("");
        } else {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          console.error("Failed to fetch weekly macros:", errorData.error);
          setError(errorData.error || "Failed to fetch weekly macros");
        }
      } catch (err: any) {
        console.error("Error fetching weekly macros:", err);
        setError(err.message || "Error fetching weekly macros");
      } finally {
        setLoading(false);
      }
    }

    fetchWeeklyMacros();
  }, [selectedDate]);

  // Reset to current week and refetch data when page comes into focus
  useFocusEffect(
    useCallback(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Reset selected date to today (this will trigger the useEffect to refetch)
      setSelectedDate(today);
    }, [])
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center px-4">
        <Text className="text-red-600 text-center">{error}</Text>
      </View>
    );
  }

  // Calculate weekly totals
  const totalProtein = protein.reduce((sum, val) => sum + val, 0);
  const totalCarbs = carbs.reduce((sum, val) => sum + val, 0);
  const totalFats = fats.reduce((sum, val) => sum + val, 0);
  const totalCalories = calories.reduce((sum, val) => sum + val, 0);

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <ScrollView 
        className="flex-1"
        showsVerticalScrollIndicator={true}
        indicatorStyle="default"
      >
        {/* Header */}
        <View className="px-4 pt-6 pb-4">
          <Text className="text-4xl font-bold text-gray-900 mb-2">Meal Analytics</Text>
          <Text className="text-base text-gray-500 mb-4">7-day nutrition tracking</Text>
          
          {/* Week Navigation */}
          <View className="flex-row items-center justify-between bg-white rounded-xl px-4 py-3 border border-gray-100">
            <TouchableOpacity 
              onPress={goToPreviousWeek}
              className="w-10 h-10 items-center justify-center rounded-full bg-gray-100"
              activeOpacity={0.7}
            >
              <Text className="text-xl text-gray-700">‹</Text>
            </TouchableOpacity>
            
            <Text className="text-base font-semibold text-gray-900">
              {weekRangeString}
            </Text>
            
            <TouchableOpacity 
              onPress={goToNextWeek}
              className="w-10 h-10 items-center justify-center rounded-full bg-gray-100"
              activeOpacity={0.7}
            >
              <Text className="text-xl text-gray-700">›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stat Cards - 2x2 Grid */}
        <View className="px-4 pb-4">
          {/* Row 1 */}
          <View className="flex-row gap-3 mb-3">
            <StatCard 
              label="Protein" 
              value={totalProtein} 
              unit="g"
              dotColor="#22c55e"
              bgColor="#f0fdf4"
            />
            <StatCard 
              label="Carbs" 
              value={totalCarbs} 
              unit="g"
              dotColor="#f59e0b"
              bgColor="#fffbeb"
            />
          </View>
          {/* Row 2 */}
          <View className="flex-row gap-3">
            <StatCard 
              label="Fats" 
              value={totalFats} 
              unit="g"
              dotColor="#ef4444"
              bgColor="#fef2f2"
            />
            <StatCard 
              label="Calories" 
              value={totalCalories} 
              unit=""
              dotColor="#3b82f6"
              bgColor="#eff6ff"
            />
          </View>
        </View>

        {/* Charts */}
        <View className="px-4 py-4 gap-4">
          {/* Calories Chart */}
          <BarChart
            title="Calories"
            subtitle="Daily calorie intake"
            data={calories}
            unit=" cal"
            dotColor="#3b82f6"
          />

          {/* Protein Chart */}
          <BarChart
            title="Protein"
            subtitle="Daily protein intake"
            data={protein}
            unit="g"
            dotColor="#22c55e"
            maxValue={160}
          />

          {/* Carbohydrates Chart */}
          <BarChart
            title="Carbohydrates"
            subtitle="Daily carb intake"
            data={carbs}
            unit="g"
            dotColor="#f59e0b"
            maxValue={260}
          />

          {/* Fats Chart */}
          <BarChart
            title="Fats"
            subtitle="Daily fat intake"
            data={fats}
            unit="g"
            dotColor="#ef4444"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

