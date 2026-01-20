// components/Questions.tsx
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import '../global.css';

interface QuestionProps {
  title: string;
  options: string[];
  link: string; // Next route to navigate to
  field: string; // Field name to update in backend
}

export default function Question({
  title,
  options,
  link,
  field,
}: QuestionProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Get API base URL from environment variable
  const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';

  const optionButtons = options.map((item, index) => {
    const isSelected = index === selectedIndex;

    return (
      <TouchableOpacity
        key={index}
        onPress={() => setSelectedIndex(index)}
        className={`w-full py-4 px-6 rounded-xl mb-3 items-center ${
          isSelected ? "bg-blue-600" : "bg-white border-2 border-gray-200"
        }`}
        activeOpacity={0.7}
      >
        <Text
          className={`text-xl text-center ${
            isSelected ? "text-white font-semibold" : "text-black"
          }`}
        >
          {item}
        </Text>
      </TouchableOpacity>
    );
  });

  async function sendData() {
    if (selectedIndex === null) {
      setError("Please select an option");
      return;
    }

    const selectedValue = options[selectedIndex];
    setLoading(true);
    setError("");

    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        setError("Not authenticated. Please login again.");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/update-field`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ field, selectedValue }),
      });

      if (response.ok) {
        router.push(link as any);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to update");
      }
    } catch (err: any) {
      console.error("Error:", err);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView 
      className="flex-1 bg-white"
      showsVerticalScrollIndicator={true}
      indicatorStyle="default"
    >
      <View className="flex-1 min-h-screen px-6 py-12 justify-center">
        {/* Title */}
        <Text className="text-4xl font-bold text-gray-900 mb-12 text-center">
          {title}
        </Text>

        {/* Options */}
        <View className="w-full mb-8">
          {optionButtons}
        </View>

        {/* Error Message */}
        {error ? (
          <View className="mb-4">
            <Text className="text-red-600 text-sm text-center">{error}</Text>
          </View>
        ) : null}

        {/* Continue Button */}
        <TouchableOpacity
          className={`w-full bg-blue-600 py-4 px-6 rounded-2xl items-center ${
            loading || selectedIndex === null ? "opacity-50" : ""
          }`}
          onPress={sendData}
          disabled={loading || selectedIndex === null}
          activeOpacity={0.8}
        >
          <Text className="text-white text-xl font-semibold">
            {loading ? "Saving..." : "Continue"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}