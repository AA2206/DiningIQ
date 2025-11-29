// app/index.tsx
import { View, Text, ScrollView } from "react-native";
import { Link } from "expo-router";
import { TouchableOpacity } from "react-native";
import '../global.css';

export default function Index() {
  return (
    <ScrollView className="flex-1 bg-gradient-to-b from-blue-50 to-white">
      <View className="flex-1 min-h-screen px-6 py-16 justify-center">
        {/* Hero Section */}
        <View className="items-center mb-16">
          <View className="mb-6">
            <Text className="text-6xl font-extrabold text-gray-900 mb-3 text-center leading-tight">
              Eat Healthy,{'\n'}Stay Fit
            </Text>
            <View className="h-1 w-20 bg-blue-600 mx-auto rounded-full" />
          </View>
          
          <Text className="text-xl text-gray-600 text-center mb-1 px-4 leading-relaxed max-w-md">
            Get personalized daily meal plans and keep track of macros to achieve your goals
          </Text>
        </View>

        {/* Features Cards */}
        <View className="w-full mb-12 gap-4">
          <View className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100">
            <View className="flex-row items-center gap-4">
              <View className="w-12 h-12 bg-blue-100 rounded-xl items-center justify-center">
                <Text className="text-2xl">🍎</Text>
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold text-gray-900 mb-1">
                  AI-Powered Recommendations
                </Text>
                <Text className="text-sm text-gray-500">
                  Smart meal planning tailored to your preferences
                </Text>
              </View>
            </View>
          </View>

          <View className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100">
            <View className="flex-row items-center gap-4">
              <View className="w-12 h-12 bg-green-100 rounded-xl items-center justify-center">
                <Text className="text-2xl">📊</Text>
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold text-gray-900 mb-1">
                  Track Your Progress
                </Text>
                <Text className="text-sm text-gray-500">
                  Monitor macros and nutrition goals effortlessly
                </Text>
              </View>
            </View>
          </View>

          <View className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100">
            <View className="flex-row items-center gap-4">
              <View className="w-12 h-12 bg-purple-100 rounded-xl items-center justify-center">
                <Text className="text-2xl">✨</Text>
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold text-gray-900 mb-1">
                  Personalized Plans
                </Text>
                <Text className="text-sm text-gray-500">
                  Customized for your dietary needs and goals
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* CTA Buttons */}
        <View className="w-full gap-3">
          <Link href="/register" asChild>
            <TouchableOpacity 
              className="w-full bg-blue-600 py-5 px-6 rounded-2xl items-center shadow-lg shadow-blue-600/30"
              activeOpacity={0.8}
            >
              <Text className="text-white text-xl font-bold tracking-wide">
                Get Started
              </Text>
            </TouchableOpacity>
          </Link>

          <Link href="/login" asChild>
            <TouchableOpacity 
              className="w-full bg-white py-5 px-6 rounded-2xl items-center border-2 border-gray-200 shadow-sm"
              activeOpacity={0.7}
            >
              <Text className="text-gray-900 text-xl font-semibold tracking-wide">
                Login
              </Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Footer Text */}
        <View className="mt-8 items-center">
          <Text className="text-sm text-gray-400 text-center">
            Join thousands of users achieving their health goals
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}