// app/onboarding/metrics.tsx
import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import '../../global.css';
import { api } from '../../lib/api';

export default function Metrics() {
  const router = useRouter();
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [age, setAge] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!height || !weight || !age) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.addMetrics(height, weight, age);

      if (response.ok) {
        router.push("/onboarding/goal" as any);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to save metrics");
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
      indicatorStyle="black"
    >
      <View className="flex-1 min-h-screen px-6 py-12 justify-center">
        {/* Title */}
        <Text className="text-4xl font-bold text-gray-900 mb-12 text-center">
          Height, Weight, and Age
        </Text>

        {/* Input Fields */}
        <View className="flex-row justify-center items-start gap-8 mb-8">
          {/* Height */}
          <View className="items-center">
            <Text className="text-xl font-semibold text-gray-700 mb-2">
              Height
            </Text>
            <TextInput
              className="h-12 w-24 px-3 text-xl text-center bg-white border-2 border-gray-300 rounded-lg"
              placeholder="0"
              value={height}
              onChangeText={setHeight}
              keyboardType="numeric"
            />
            <Text className="text-base text-gray-600 mt-2">in</Text>
          </View>

          {/* Weight */}
          <View className="items-center">
            <Text className="text-xl font-semibold text-gray-700 mb-2">
              Weight
            </Text>
            <TextInput
              className="h-12 w-24 px-3 text-xl text-center bg-white border-2 border-gray-300 rounded-lg"
              placeholder="0"
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
            />
            <Text className="text-base text-gray-600 mt-2">lb</Text>
          </View>

          {/* Age */}
          <View className="items-center">
            <Text className="text-xl font-semibold text-gray-700 mb-2">
              Age
            </Text>
            <TextInput
              className="h-12 w-24 px-3 text-xl text-center bg-white border-2 border-gray-300 rounded-lg"
              placeholder="0"
              value={age}
              onChangeText={setAge}
              keyboardType="numeric"
            />
            <Text className="text-base text-gray-600 mt-2">yrs</Text>
          </View>
        </View>

        {/* Error Message */}
        {error ? (
          <View className="mb-4">
            <Text className="text-red-600 text-sm text-center">{error}</Text>
          </View>
        ) : null}

        {/* Submit Button */}
        <TouchableOpacity
          className={`w-full bg-blue-600 py-4 px-6 rounded-2xl items-center ${
            loading ? "opacity-50" : ""
          }`}
          onPress={handleSubmit}
          disabled={loading}
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