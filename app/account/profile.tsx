// app/account/profile.tsx
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import '../../global.css';

interface UserProfile {
  username: string;
  gender: string | null;
  frequency: string | null;
  height: number | null;
  weight: number | null;
  age: number | null;
  goal: string | null;
  diet: string | null;
  other: string | null;
}

interface EditModalProps {
  visible: boolean;
  title: string;
  field: string;
  currentValue: string | number | null;
  options?: string[];
  isNumeric?: boolean;
  unit?: string;
  onClose: () => void;
  onSave: (field: string, value: string) => void;
}

function EditModal({ visible, title, field, currentValue, options, isNumeric, unit, onClose, onSave }: EditModalProps) {
  const [value, setValue] = useState(currentValue?.toString() || '');
  const [selectedOption, setSelectedOption] = useState<string | null>(currentValue?.toString() || null);

  useEffect(() => {
    setValue(currentValue?.toString() || '');
    setSelectedOption(currentValue?.toString() || null);
  }, [currentValue, visible]);

  const handleTextChange = (text: string) => {
    if (isNumeric) {
      // Only allow integers (digits only, no decimals)
      const integerOnly = text.replace(/[^0-9]/g, '');
      setValue(integerOnly);
    } else {
      setValue(text);
    }
  };

  const handleSave = () => {
    if (options) {
      if (selectedOption) onSave(field, selectedOption);
    } else {
      if (value) onSave(field, value);
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-white rounded-t-3xl p-6 pb-10">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-2xl font-bold text-gray-900">{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {options ? (
            <View className="mb-6">
              {options.map((option) => (
                <TouchableOpacity
                  key={option}
                  onPress={() => setSelectedOption(option)}
                  className={`w-full py-4 px-6 rounded-xl mb-3 items-center ${
                    selectedOption === option ? "bg-blue-600" : "bg-white border-2 border-gray-200"
                  }`}
                >
                  <Text className={`text-lg ${selectedOption === option ? "text-white font-semibold" : "text-black"}`}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View className="mb-6">
              <View className="flex-row items-center">
                <TextInput
                  className="flex-1 h-14 px-4 text-lg bg-gray-50 border border-gray-200 rounded-xl"
                  placeholder={`Enter ${title.toLowerCase()}`}
                  value={value}
                  onChangeText={handleTextChange}
                  keyboardType={isNumeric ? "number-pad" : "default"}
                />
                {unit && <Text className="ml-3 text-lg text-gray-600">{unit}</Text>}
              </View>
            </View>
          )}

          <TouchableOpacity
            className="w-full bg-blue-600 py-4 rounded-xl items-center"
            onPress={handleSave}
          >
            <Text className="text-white text-lg font-semibold">Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function Profile() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editModal, setEditModal] = useState<{
    visible: boolean;
    title: string;
    field: string;
    currentValue: string | number | null;
    options?: string[];
    isNumeric?: boolean;
    unit?: string;
  }>({ visible: false, title: '', field: '', currentValue: null });
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/" as any);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/user-profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      } else {
        setError("Failed to load profile");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function updateField(field: string, value: string) {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      // For metrics fields, use add-metrics endpoint
      if (['height', 'weight', 'age'].includes(field)) {
        const response = await fetch(`${API_BASE_URL}/add-metrics`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            height: field === 'height' ? value : profile?.height ?? 0,
            weight: field === 'weight' ? value : profile?.weight ?? 0,
            age: field === 'age' ? value : profile?.age ?? 0,
          }),
        });

        if (response.ok) {
          setProfile(prev => prev ? { ...prev, [field]: parseFloat(value) } : null);
        }
      } else if (field === 'other') {
        // Use the /other endpoint
        const response = await fetch(`${API_BASE_URL}/other`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ other: value }),
        });

        if (response.ok) {
          setProfile(prev => prev ? { ...prev, other: value } : null);
        }
      } else {
        // Use update-field for other fields
        const response = await fetch(`${API_BASE_URL}/update-field`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ field, selectedValue: value }),
        });

        if (response.ok) {
          setProfile(prev => prev ? { ...prev, [field]: value } : null);
        }
      }
    } catch (err) {
      console.error("Error updating field:", err);
    }
  }

  async function handleLogout() {
    try {
      // Sign out from Google if signed in
      const currentUser = await GoogleSignin.getCurrentUser();
      if (currentUser) {
        await GoogleSignin.signOut();
      }
    } catch (err) {
      console.log("Google sign out error:", err);
    }

    // Clear local storage
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("supabase_session");
    
    // Navigate to landing page
    router.replace("/" as any);
  }

  async function handleDeleteAccount() {
    setIsDeleting(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        setError("Not authenticated");
        setIsDeleting(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/delete-account`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Always clear token and all local storage, regardless of response
      // This ensures the user is logged out even if there's a network error
      // after the account was successfully deleted on the backend
      try {
        // Sign out from Google if signed in
        const currentUser = await GoogleSignin.getCurrentUser();
        if (currentUser) {
          await GoogleSignin.signOut();
        }
      } catch (err) {
        console.log("Google sign out error:", err);
      }

      // Clear ALL local storage data
      await AsyncStorage.clear();

      if (response.ok) {
        // Account deleted successfully, navigate to landing page
        router.replace("/" as any);
      } else {
        // Even if deletion failed, we've cleared the token
        // User will need to log in again
        const data = await response.json();
        setError(data.error || "Failed to delete account. You have been logged out.");
        setIsDeleting(false);
        setDeleteConfirmVisible(false);
        // Still redirect to landing page since token is cleared
        setTimeout(() => {
          router.replace("/" as any);
        }, 2000);
      }
    } catch (err) {
      console.error("Error deleting account:", err);
      // Clear token even on network errors, in case account was deleted
      try {
        await AsyncStorage.clear();
      } catch (clearErr) {
        console.error("Error clearing storage:", clearErr);
      }
      setError("Network error. You have been logged out for security.");
      setIsDeleting(false);
      setDeleteConfirmVisible(false);
      // Redirect to landing page since token is cleared
      setTimeout(() => {
        router.replace("/" as any);
      }, 2000);
    }
  }

  const openEditModal = (title: string, field: string, currentValue: string | number | null, options?: string[], isNumeric?: boolean, unit?: string) => {
    setEditModal({ visible: true, title, field, currentValue, options, isNumeric, unit });
  };

  if (loading) {
    return (
      <View className="flex-1 bg-white justify-center items-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const ProfileRow = ({ label, value, onPress }: { label: string; value: string | number | null; onPress: () => void }) => (
    <TouchableOpacity 
      onPress={onPress}
      className="flex-row justify-between items-center py-4 border-b border-gray-100"
    >
      <Text className="text-base text-gray-600">{label}</Text>
      <View className="flex-row items-center">
        <Text className="text-base text-gray-900 mr-2">{value || 'Not set'}</Text>
        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView 
      className="flex-1 bg-gray-50"
      showsVerticalScrollIndicator={true}
      indicatorStyle="default"
    >
      <View className="px-6 pt-16 pb-8">
        {/* Header */}
        <Text className="text-3xl font-bold text-gray-900 mb-6">Profile</Text>

        {/* Profile Info Card */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-4">Personal Information</Text>
          
          <ProfileRow 
            label="Gender" 
            value={profile?.gender ?? null} 
            onPress={() => openEditModal('Gender', 'gender', profile?.gender || null, ['Male', 'Female', 'Other'])}
          />
          <ProfileRow 
            label="Age" 
            value={profile?.age ? `${profile.age} yrs` : null} 
            onPress={() => openEditModal('Age', 'age', profile?.age || null, undefined, true, 'yrs')}
          />
          <ProfileRow 
            label="Height" 
            value={profile?.height ? `${profile.height} in` : null} 
            onPress={() => openEditModal('Height', 'height', profile?.height || null, undefined, true, 'in')}
          />
          <ProfileRow 
            label="Weight" 
            value={profile?.weight ? `${profile.weight} lb` : null} 
            onPress={() => openEditModal('Weight', 'weight', profile?.weight || null, undefined, true, 'lb')}
          />
        </View>

        {/* Preferences Card */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-4">Diet Preferences</Text>
          
          <ProfileRow 
            label="Goal" 
            value={profile?.goal ?? null} 
            onPress={() => openEditModal('Goal', 'goal', profile?.goal || null, ['Build Muscle', 'Lose Weight', 'Improve Fitness'])}
          />
          <ProfileRow 
            label="Diet Type" 
            value={profile?.diet ?? null} 
            onPress={() => openEditModal('Diet Type', 'diet', profile?.diet || null, ['Classic', 'Vegetarian', 'Vegan', 'Pescetarian'])}
          />
          <ProfileRow 
            label="Workout Frequency" 
            value={profile?.frequency ? `${profile.frequency} per week` : null} 
            onPress={() => openEditModal('Workout Frequency', 'frequency', profile?.frequency || null, ['0-2', '3-5', '6+'])}
          />
          <ProfileRow 
            label="Allergies/Restrictions" 
            value={profile?.other ?? null} 
            onPress={() => openEditModal('Allergies/Restrictions', 'other', profile?.other || null)}
          />
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          onPress={handleLogout}
          className="bg-red-50 border border-red-200 rounded-2xl py-4 items-center mb-4"
        >
          <View className="flex-row items-center">
            <Ionicons name="log-out-outline" size={24} color="#dc2626" />
            <Text className="text-red-600 text-lg font-semibold ml-2">Log Out</Text>
          </View>
        </TouchableOpacity>

        {/* Delete Account Button */}
        <TouchableOpacity
          onPress={() => setDeleteConfirmVisible(true)}
          className="bg-red-600 rounded-2xl py-4 items-center mb-8"
          disabled={isDeleting}
        >
          <View className="flex-row items-center">
            <Ionicons name="trash-outline" size={24} color="#ffffff" />
            <Text className="text-white text-lg font-semibold ml-2">
              {isDeleting ? "Deleting..." : "Delete Account"}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Edit Modal */}
      <EditModal
        visible={editModal.visible}
        title={editModal.title}
        field={editModal.field}
        currentValue={editModal.currentValue}
        options={editModal.options}
        isNumeric={editModal.isNumeric}
        unit={editModal.unit}
        onClose={() => setEditModal({ ...editModal, visible: false })}
        onSave={updateField}
      />

      {/* Delete Account Confirmation Modal */}
      <Modal visible={deleteConfirmVisible} transparent animationType="fade">
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-2xl p-6 mx-6 w-11/12">
            <Text className="text-2xl font-bold text-gray-900 mb-2">Delete Account</Text>
            <Text className="text-base text-gray-600 mb-6">
              Are you sure you want to delete your account? This action cannot be undone. All your data including meal plans, meal logs, and statistics will be permanently deleted.
            </Text>
            <View className="flex-row justify-end">
              <TouchableOpacity
                onPress={() => {
                  setDeleteConfirmVisible(false);
                  setError("");
                }}
                className="px-6 py-3 rounded-xl mr-3"
                disabled={isDeleting}
              >
                <Text className="text-gray-600 text-lg font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteAccount}
                className="bg-red-600 px-6 py-3 rounded-xl"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="text-white text-lg font-semibold">Delete</Text>
                )}
              </TouchableOpacity>
            </View>
            {error && (
              <Text className="text-red-600 text-sm mt-4">{error}</Text>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}