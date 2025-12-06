// components/AuthForm.tsx
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import { useState, forwardRef, useImperativeHandle } from "react";
import '../global.css';

interface AuthFormProps {
  title: string;
  handleSubmit: (username: string, password: string) => void;
  onGoogleSignIn?: () => void;
  isGoogleLoading?: boolean;
}

export interface AuthFormRef {
  setError: (message: string) => void;
}

const AuthForm = forwardRef<AuthFormRef, AuthFormProps>(({
  title,
  handleSubmit,
  onGoogleSignIn,
  isGoogleLoading = false,
}, ref) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useImperativeHandle(ref, () => ({
    setError: (message: string) => {
      setErrorMessage(message);
    },
  }));

  const onSubmit = () => {
    setErrorMessage(""); // Clear previous errors
    handleSubmit(username, password);
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 min-h-screen px-6 py-12">
        {/* Header with Logo */}
        <View className="mb-8">
          <Link href="/">
            <Text className="text-3xl font-bold text-gray-900">
              DietIQ
            </Text>
          </Link>
        </View>

        {/* Main Content */}
        <View className="flex-1 justify-center">
          <Text className="text-4xl font-bold text-gray-900 mb-8">
            {title}
          </Text>

          {/* Form */}
          <View className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-6">
            {/* Username Input */}
            <View className="mb-6">
              <Text className="text-base font-semibold text-gray-700 mb-2">
                Username
              </Text>
              <TextInput
                className="h-14 px-4 text-lg bg-gray-50 border border-gray-200 rounded-xl"
                placeholder="Enter your username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password Input */}
            <View className="mb-6">
              <Text className="text-base font-semibold text-gray-700 mb-2">
                Password
              </Text>
              <TextInput
                className="h-14 px-4 text-lg bg-gray-50 border border-gray-200 rounded-xl"
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Error Message */}
            {errorMessage ? (
              <View className="mb-4">
                <Text className="text-red-600 text-sm">{errorMessage}</Text>
              </View>
            ) : null}

            {/* Submit Button */}
            <TouchableOpacity
              className="w-full bg-blue-600 py-4 rounded-xl items-center"
              onPress={onSubmit}
              activeOpacity={0.8}
            >
              <Text className="text-white text-lg font-semibold">
                Submit
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            {onGoogleSignIn && (
              <>
                <View className="flex-row items-center my-6">
                  <View className="flex-1 h-px bg-gray-200" />
                  <Text className="mx-4 text-gray-500 text-sm">or</Text>
                  <View className="flex-1 h-px bg-gray-200" />
                </View>

                {/* Google Sign-In Button */}
                <TouchableOpacity
                  className="w-full bg-white border border-gray-300 py-4 rounded-xl flex-row items-center justify-center"
                  onPress={onGoogleSignIn}
                  activeOpacity={0.8}
                  disabled={isGoogleLoading}
                >
                  {isGoogleLoading ? (
                    <ActivityIndicator size="small" color="#4285F4" />
                  ) : (
                    <>
                      {/* Google Logo SVG represented as colored circles/text */}
                      <View className="w-6 h-6 mr-3 items-center justify-center">
                        <Text className="text-lg font-bold">
                          <Text style={{ color: '#4285F4' }}>G</Text>
                        </Text>
                      </View>
                      <Text className="text-gray-700 text-lg font-semibold">
                        Continue with Google
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
});

AuthForm.displayName = 'AuthForm';

export default AuthForm;
