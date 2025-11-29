// components/AuthForm.tsx
import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { Link } from "expo-router";
import { useState, forwardRef, useImperativeHandle } from "react";
import '../global.css';

interface AuthFormProps {
  title: string;
  handleSubmit: (username: string, password: string) => void;
}

export interface AuthFormRef {
  setError: (message: string) => void;
}

const AuthForm = forwardRef<AuthFormRef, AuthFormProps>(({
  title,
  handleSubmit,
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
          </View>
        </View>
      </View>
    </ScrollView>
  );
});

AuthForm.displayName = 'AuthForm';

export default AuthForm;