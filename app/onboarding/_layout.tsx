import { Stack } from 'expo-router'; 

export default function OnboardingLayout() {
    return (
        <Stack>
            <Stack.Screen name = "gender" options={{ headerShown: false }} />
            <Stack.Screen name = "frequency" options={{ headerShown: false }} />
            <Stack.Screen name = "metrics" options={{ headerShown: false }} />
            <Stack.Screen name = "goal" options={{ headerShown: false }} />
            <Stack.Screen name = "diet" options={{ headerShown: false }} />
            <Stack.Screen name = "other" options={{ headerShown: false }} />
        </Stack>
    )
}