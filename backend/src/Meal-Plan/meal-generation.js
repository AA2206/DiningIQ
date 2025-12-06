import { google } from '@ai-sdk/google';
import { PrismaClient } from '@prisma/client';
import { generateObject } from 'ai';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const prisma = new PrismaClient();

async function generateResponse(user_query, meal_type) {
    // Only Brunch needs special handling - include Breakfast, Lunch, and Brunch items
    const mealFilter = meal_type === "Brunch" 
      ? { in: ["Brunch", "Breakfast", "Lunch"] }
      : meal_type;

    const allMenuData = await prisma.uMD_Dining.findMany({
        select: {
            id: true,
            entree: true,
            diningHall: true,
            meal: true,
            dietaryInformation: true,
            category: true
        },
        where: {
            meal: mealFilter
        }
    });

    const menuJson = JSON.stringify(allMenuData); 

    const mealPlanSchema = z.object({
        Yahentamitisi_Dining_Hall: z.array(
            z.object({
                Meal_Option: z.string(), 
                Description: z.string(), 
                Entrees: z.array(z.object({id: z.number(), entree: z.string()}))
            })
        ),
        South_Campus_Dining_Hall: z.array(
            z.object({
                Meal_Option: z.string(), 
                Description: z.string(), 
                Entrees: z.array(z.object({id: z.number(), entree: z.string()}))
            })
        ),
        North_251_Dining_Hall: z.array(
            z.object({
                Meal_Option: z.string(), 
                Description: z.string(), 
                Entrees: z.array(z.object({id: z.number(), entree: z.string()}))
            })
        )
    }); 

    const { object: mealPlan} = await generateObject({
      model: google('gemini-2.5-pro'), 
      schema: mealPlanSchema,
      system: "You are a expert dietition that can gives users meal recommendations based on their dietary preferences and goals.",
      prompt: "Using the attached dining hall nutrition database generate meal options for the users at all 3 dining halls (South Campus, Yahentamitsi Dining Hall, and 251 North)" +
            "You can either use entrees directly from the database or combine entrees with the same category in the database to create a meal option" +
            "Include the name of the meal option and a detailed description of the meal option" +
            "For each Meal_Option, the 'Entrees' array must contain the exact 'id' and 'entree' name from the database - use them exactly as written, do not modify." + 
            "This is the user's query: " + user_query + 
            "Here is the dining hall menu and nutrition database: " + menuJson,
    });
    
    return mealPlan;
}

async function main() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const meals = (dayOfWeek === 0 || dayOfWeek === 6) ? ["Brunch", "Dinner"] : ["Breakfast", "Lunch", "Dinner"];

    const allUsers = await prisma.user.findMany();
    const allMenuData = await prisma.uMD_Dining.findMany({
        select: {
          id: true,
          entree: true,
          diningHall: true,
          meal: true,
          dietaryInformation: true,
          category: true
        },
        where: {
          meal: { in: ["Brunch", "Breakfast", "Lunch"] }
        },
    });
    console.log(allMenuData); 

    for (const user_data of allUsers) {
        const mealPlans = {}

        const user_query = user_data.username + " is a " + user_data.gender + " who is " + user_data.height + " inches tall, " + user_data.weight + " pounds, and " + user_data.age + " years old. " + 
        "Their goal is to " + user_data.goal + " and they workout " + user_data.frequency + " times a week. They have a " + user_data.diet + " diet and '" + user_data.other + 
        "allergies/dietary restrictions."

        for (const meal of meals) {
            const mealPlan = await generateResponse(user_query, meal);
            mealPlans[meal] = mealPlan;
        }

        console.log(mealPlans)

        await prisma.user.update({
            where: { id: user_data.id },
            data: { mealPlan: mealPlans }
        });

    }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
});