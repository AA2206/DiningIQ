import { Tabs } from "expo-router";
import '../../global.css'

export default function AccountLayout(){
    return (
        <Tabs>
            <Tabs.Screen 
                name="mealPlan" 
                options={{ title: 'Meal Plan', headerShown: false }}
            />
            <Tabs.Screen 
                name="mealLogging" 
                options={{ title: 'Meal Logging', headerShown: false }}
            />
            <Tabs.Screen
                name = "macrosAnalytics"
                options={{ title: 'Macros Analytics', headerShown: false}}
            />
        </Tabs>
    )
}