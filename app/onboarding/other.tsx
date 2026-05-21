// app/onboarding/other.tsx
import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import '../../global.css';
import { api } from '../../lib/api';

export default function Other() {
  const router = useRouter();
  const [other, setOther] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!other.trim()) {
      setError("Please enter any allergies or dietary restrictions");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.updateOther(other);

      if (response.ok) {
        // Read the response body to ensure the request is fully processed
        await response.json();
        // Use replace instead of push to ensure navigation completes
        // Add a small delay to ensure the response is fully processed
        setTimeout(() => {
          router.replace("/loading" as any);
        }, 100);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to save information");
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
          Any Other Allergies/Dietary Restrictions
        </Text>

        {/* Input Field */}
        <View className="w-full mb-8">
          <TextInput
            className="h-14 w-full px-4 text-lg bg-white border-2 border-gray-300 rounded-xl"
            placeholder="Enter any allergies or dietary restrictions"
            value={other}
            onChangeText={setOther}
            multiline={false}
            autoCapitalize="sentences"
          />
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