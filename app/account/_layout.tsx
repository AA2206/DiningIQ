import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import '../../global.css'

// Custom Tab Bar Icon component
interface TabIconProps {
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  focused: boolean;
}

function TabIcon({ iconName, label, focused }: TabIconProps) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 4, minWidth: 80 }}>
      <Ionicons 
        name={iconName} 
        size={24} 
        color={focused ? '#2563eb' : '#9ca3af'} 
      />
      <Text 
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ 
          fontSize: 10, 
          marginTop: 4,
          fontWeight: '500',
          color: focused ? '#2563eb' : '#9ca3af',
          textAlign: 'center',
          width: '100%',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function AccountLayout(){
    return (
        <Tabs
          screenOptions={{
            tabBarShowLabel: false,
            tabBarStyle: {
              backgroundColor: '#ffffff',
              borderTopWidth: 1,
              borderTopColor: '#e5e7eb',
              height: 85,
              paddingTop: 10,
              paddingBottom: 28,
              paddingHorizontal: 4,
            },
          }}
        >
            <Tabs.Screen 
                name="mealPlan" 
                options={{ 
                  title: 'Meal Plan', 
                  headerShown: false,
                  tabBarIcon: ({ focused }) => (
                    <TabIcon 
                      iconName="restaurant-outline"
                      label="Meal Plan" 
                      focused={focused} 
                    />
                  ),
                }}
            />
            <Tabs.Screen 
                name="mealLogging" 
                options={{ 
                  title: 'Meal Logging', 
                  headerShown: false,
                  tabBarIcon: ({ focused }) => (
                    <TabIcon 
                      iconName="clipboard-outline"
                      label="Meal Logging" 
                      focused={focused} 
                    />
                  ),
                }}
            />
            <Tabs.Screen
                name="macrosAnalytics"
                options={{ 
                  title: 'Macros Analytics', 
                  headerShown: false,
                  tabBarIcon: ({ focused }) => (
                    <TabIcon 
                      iconName="bar-chart-outline"
                      label="Analytics" 
                      focused={focused} 
                    />
                  ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{ 
                  title: 'Profile', 
                  headerShown: false,
                  tabBarIcon: ({ focused }) => (
                    <TabIcon 
                      iconName="person-outline"
                      label="Profile" 
                      focused={focused} 
                    />
                  ),
                }}
            />
        </Tabs>
    )
}