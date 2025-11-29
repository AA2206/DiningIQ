// app/account/macrosAnalytics.tsx
import { useState, useEffect, useMemo } from "react";
import { View, Text, ActivityIndicator, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import '../../global.css';

// Bar Chart Component
interface BarChartProps {
  title: string;
  subtitle: string;
  data: number[];
  unit: string;
  maxValue?: number;
}

function BarChart({ title, subtitle, data, unit, maxValue }: BarChartProps) {
  // State to track which bar is selected (showing value)
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);

  // Calculate max value - use the larger of provided maxValue or actual data max
  const dataMax = Math.max(...data, 1);
  const chartMax = maxValue 
    ? Math.max(maxValue, dataMax) * 1.1 // Use maxValue but ensure it covers data, add 10% padding
    : dataMax * 1.2; // If no maxValue, use data max with 20% padding
  
  // Round up to nearest nice number for cleaner display
  const roundedMax = Math.ceil(chartMax / 10) * 10;
  
  // Generate Y-axis labels (4 tick marks) using roundedMax
  const yAxisLabels = useMemo(() => {
    const ticks = 4;
    const labels: number[] = [];
    for (let i = 0; i <= ticks; i++) {
      labels.push(Math.round((roundedMax / ticks) * i));
    }
    return labels; // 0 at index 0, max at last index
  }, [roundedMax]);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const chartHeight = 200;
  const chartWidth = '100%';

  return (
    <View className="bg-white rounded-xl p-6 mb-6 shadow-md border border-gray-200">
      <Text className="text-2xl font-bold text-gray-900 mb-1">{title}</Text>
      <Text className="text-sm text-gray-600 mb-6">{subtitle}</Text>
      
      {/* Chart Container */}
      <View className="relative" style={{ height: chartHeight }}>
        {/* Y-axis Labels - positioned to align with X-axis */}
        <View className="absolute left-0 top-0 bottom-0 w-12 items-end pr-2">
          {yAxisLabels.map((label, index) => {
            // Position: index 0 (value 0) at X-axis (bottom), last index (max) at top
            const positionPercent = (index / (yAxisLabels.length - 1)) * 100;
            return (
              <View
                key={index}
                className="absolute justify-center"
                style={{
                  bottom: `${positionPercent}%`,
                }}
              >
                <Text className="text-xs text-gray-600">{label}</Text>
              </View>
            );
          })}
        </View>

        {/* Chart Area with Grid Lines */}
        <View className="ml-16 mr-2 flex-1">
          {/* Grid Lines - align with Y-axis labels */}
          {yAxisLabels.map((_, index) => {
            // Position: index 0 (value 0) at X-axis (bottom), last index (max) at top
            const positionPercent = (index / (yAxisLabels.length - 1)) * 100;
            return (
              <View
                key={index}
                className="absolute left-0 right-0 border-t border-gray-200"
                style={{
                  bottom: `${positionPercent}%`,
                }}
              />
            );
          })}

          {/* Bars Container - bars start at X-axis (bottom) */}
          <View className="flex-row justify-between" style={{ height: '100%', alignItems: 'flex-end' }}>
            {data.map((value, index) => {
              // Use roundedMax for bar height calculation to match Y-axis labels
              // Bars grow from X-axis (bottom) upward
              const barHeightPercent = Math.min((value / roundedMax) * 100, 100);
              const isSelected = selectedBarIndex === index;
              
              return (
                <View key={index} className="flex-1 items-center mx-0.5" style={{ height: '100%', justifyContent: 'flex-end', paddingBottom: 0 }}>
                  {/* Value Tooltip */}
                  {isSelected && value > 0 && (
                    <View className="absolute items-center" style={{ width: '100%', bottom: '100%', marginBottom: 4 }}>
                      <View className="bg-gray-900 px-2 py-1 rounded">
                        <Text className="text-white text-xs font-semibold">
                          {Math.round(value)}{unit}
                        </Text>
                      </View>
                      {/* Tooltip arrow */}
                      <View 
                        style={{
                          width: 0,
                          height: 0,
                          borderLeftWidth: 4,
                          borderRightWidth: 4,
                          borderTopWidth: 4,
                          borderLeftColor: 'transparent',
                          borderRightColor: 'transparent',
                          borderTopColor: '#111827', // gray-900
                          marginTop: -1,
                        }}
                      />
                    </View>
                  )}
                  
                  {/* Bar */}
                  <TouchableOpacity
                    onPress={() => setSelectedBarIndex(isSelected ? null : index)}
                    activeOpacity={0.8}
                    style={{ width: '100%', height: `${barHeightPercent}%`, minHeight: value > 0 ? 2 : 0 }}
                  >
                    <View
                      className={`w-full h-full rounded-t ${isSelected ? 'bg-gray-700' : 'bg-black'}`}
                    />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* X-axis Labels */}
      <View className="flex-row justify-between mt-2 ml-16 mr-2">
        {days.map((day, index) => (
          <Text key={index} className="text-xs text-gray-600 flex-1 text-center">
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

  // State arrays for weekly macros (Monday = index 0, Sunday = index 6)
  const [protein, setProtein] = useState<number[]>(new Array(7).fill(0));
  const [carbs, setCarbs] = useState<number[]>(new Array(7).fill(0));
  const [fats, setFats] = useState<number[]>(new Array(7).fill(0));
  const [calories, setCalories] = useState<number[]>(new Array(7).fill(0));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch weekly macros from backend
  useEffect(() => {
    async function fetchWeeklyMacros() {
      try {
        // Get authentication token
        const token = await AsyncStorage.getItem("token");
        if (!token) {
          console.error("Not authenticated");
          setError("Not authenticated");
          setLoading(false);
          return;
        }

        // Make API call
        const response = await fetch(`${API_BASE_URL}/weekly-macros`, {
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
  }, []);

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

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <ScrollView className="flex-1 px-4 py-6">
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-gray-900 mb-1">Meal Analytics</Text>
          <Text className="text-base text-gray-600">7-day nutrition tracking</Text>
        </View>

        {/* Protein Chart */}
        <BarChart
          title="Protein"
          subtitle="Daily protein intake (grams)"
          data={protein}
          unit="g"
          maxValue={160}
        />

        {/* Carbohydrates Chart */}
        <BarChart
          title="Carbohydrates"
          subtitle="Daily carb intake (grams)"
          data={carbs}
          unit="g"
          maxValue={260}
        />

        {/* Fats Chart */}
        <BarChart
          title="Fats"
          subtitle="Daily fat intake (grams)"
          data={fats}
          unit="g"
        />

        {/* Calories Chart */}
        <BarChart
          title="Calories"
          subtitle="Daily calorie intake (cal)"
          data={calories}
          unit="cal"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

