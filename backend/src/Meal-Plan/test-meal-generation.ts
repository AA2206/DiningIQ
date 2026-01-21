// Test file for meal plan generation
// Run with: npx ts-node backend/src/Meal-Plan/test-meal-generation.ts

import OpenAI from "openai";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();
const client = new OpenAI();

async function generateMealPlanResponse(user_query: string, meal_type: string, today: boolean = true) {
  console.log(`\n=== Generating meal plan for ${meal_type} (today: ${today}) ===`);
  
  // Determine which meal types to include based on the selected meal type
  let mealFilter: any;
  
  if (meal_type === "Brunch") {
    // Brunch shows: Breakfast + Lunch + Brunch
    mealFilter = { in: ["Brunch", "Breakfast", "Lunch"] as any[] };
  } else if (meal_type === "Breakfast") {
    // Breakfast shows: Breakfast + Brunch
    mealFilter = { in: ["Breakfast", "Brunch"] as any[] };
  } else if (meal_type === "Lunch") {
    // Lunch shows: Lunch + Brunch
    mealFilter = { in: ["Lunch", "Brunch"] as any[] };
  } else {
    // Dinner shows: Just Dinner
    mealFilter = meal_type as any;
  }

  console.log(`Fetching menu data from ${today ? 'uMD_Dining' : 'uMD_Dining2'}...`);
  
  // Select which table to use based on today parameter
  const currMenuData = today 
    ? await prisma.uMD_Dining.findMany({
        select: {
          id: true,
          entree: true,
          diningHall: true,
          meal: true,
          dietaryInformation: true,
          category: true, 
          totalCalories: true, 
          protein: true
        },
        where: {
          meal: mealFilter
        },
      })
    : await prisma.uMD_Dining2.findMany({
        select: {
          id: true,
          entree: true,
          diningHall: true,
          meal: true,
          dietaryInformation: true,
          category: true, 
          totalCalories: true, 
          protein: true
        },
        where: {
          meal: mealFilter
        },
      });

  console.log(`Found ${currMenuData.length} menu items`);

  const schema = {
    format: {
      type: "json_schema" as const,
      name: "meal_plan",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: [
          "Yahentamitisi_Dining_Hall",
          "South_Campus_Dining_Hall",
          "North_251_Dining_Hall"
        ],
        properties: {
          Yahentamitisi_Dining_Hall: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["Meal_Option", "Description", "Entrees"],
              properties: {
                Meal_Option: { type: "string", minLength: 1 },
                Description: { type: "string", minLength: 1 },
                Entrees: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["id", "entree"],
                    properties: {
                      id: { type: "number" },
                      entree: { type: "string", minLength: 1 }
                    }
                  }
                }
              }
            }
          },
  
          South_Campus_Dining_Hall: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["Meal_Option", "Description", "Entrees"],
              properties: {
                Meal_Option: { type: "string", minLength: 1 },
                Description: { type: "string", minLength: 1 },
                Entrees: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["id", "entree"],
                    properties: {
                      id: { type: "number" },
                      entree: { type: "string", minLength: 1 }
                    }
                  }
                }
              }
            }
          },
  
          North_251_Dining_Hall: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["Meal_Option", "Description", "Entrees"],
              properties: {
                Meal_Option: { type: "string", minLength: 1 },
                Description: { type: "string", minLength: 1 },
                Entrees: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["id", "entree"],
                    properties: {
                      id: { type: "number" },
                      entree: { type: "string", minLength: 1 }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  const menuJson = JSON.stringify(currMenuData);
  console.log(`Menu JSON length: ${menuJson.length} characters`);

  const system_prompt = "You are a expert dietition that can gives users meal recommendations based on their dietary preferences and goals."

  const prompt = "Using the attached dining hall nutrition database generate meal options for the users at all 3 dining halls (South Campus, Yahentamitsi Dining Hall, and 251 North)" +
  "You can either use entrees directly from the database or combine entrees with the same category in the database to create a meal option" +
  "Include the name of the meal option and a detailed description of the meal option" +
  "For each Meal_Option, the 'Entrees' array must contain the exact 'id' and 'entree' name from the database - use them exactly as written, do not modify." + 
  "This is the user's query: " + user_query + 
  "Here is the dining hall menu and nutrition database: " + menuJson

  console.log(`Making OpenAI API call...`);
  console.log(`Prompt length: ${prompt.length} characters`);
  
  const startTime = Date.now();
  
  try {
    const response = await client.responses.create({
      model: "gpt-5",
      instructions: system_prompt, 
      input: prompt,
      text: schema
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✓ API call completed in ${elapsed} seconds`);
    console.log(`Response type: ${typeof response}`);
    console.log(`Response keys: ${Object.keys(response).join(', ')}`);
    
    // Check response structure - try different possible formats
    const responseAny = response as any;
    
    if (responseAny.output_text) {
      console.log(`Found output_text property`);
      return responseAny.output_text;
    } else if (responseAny.output && Array.isArray(responseAny.output)) {
      console.log(`Found output array, length: ${responseAny.output.length}`);
      for (const outputItem of responseAny.output) {
        if (outputItem.type === "message" && outputItem.content) {
          for (const contentItem of outputItem.content) {
            if (contentItem.type === "output_text" && contentItem.text) {
              console.log(`Found text property in output_text content`);
              return JSON.parse(contentItem.text);
            } else if (contentItem.text) {
              console.log(`Found text property in content`);
              return JSON.parse(contentItem.text);
            }
          }
        } else if (outputItem.content && Array.isArray(outputItem.content)) {
          for (const contentItem of outputItem.content) {
            if (contentItem.text) {
              console.log(`Found text property in nested content`);
              return JSON.parse(contentItem.text);
            }
          }
        }
      }
    }
    
    console.log(`Full response structure:`, JSON.stringify(response, null, 2));
    throw new Error('Could not find meal plan data in response');
    
  } catch (error: any) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`✗ API call failed after ${elapsed} seconds`);
    console.error(`Error:`, error);
    throw error;
  }
}

async function generateMealPlanForUser(username: string) {
  console.log(`\n=== Testing meal plan generation for user: ${username} ===`);
  
  // Get user data
  const user = await prisma.user.findUnique({
    where: { username: username },
    select: {
      gender: true,
      height: true,
      weight: true,
      age: true,
      goal: true,
      frequency: true,
      diet: true,
      other: true,
    }
  });

  if (!user) {
    throw new Error('User not found');
  }

  console.log(`User data:`, user);

  // Build user query string
  const user_query = `${username} is a ${user.gender || 'person'} who is ${user.height || 'unknown'} inches tall, ${user.weight || 'unknown'} pounds, and ${user.age || 'unknown'} years old. ` +
    `Their goal is to ${user.goal || 'maintain health'} and they workout ${user.frequency || '0'} times a week. They have a ${user.diet || 'standard'} diet and '${user.other || 'no'} allergies/dietary restrictions.`;

  console.log(`User query: ${user_query}`);

  const today = new Date();
  const dayOfWeek = today.getDay();
  const meals = (dayOfWeek === 0 || dayOfWeek === 6) ? ["Brunch", "Dinner"] : ["Breakfast", "Lunch", "Dinner"];
  const meals2 = (dayOfWeek + 1 === 0 || dayOfWeek + 1 === 6) ? ["Brunch", "Dinner"] : ["Breakfast", "Lunch", "Dinner"];
    
  console.log(`Today's meals: ${meals.join(', ')}`);
  console.log(`Tomorrow's meals: ${meals2.join(', ')}`);
    
  const mealPlans: Record<string, any> = {};
  const mealPlans2: Record<string, any> = {}; 

  // Generate meal plan for each meal type (sequential like original)
  console.log(`\n=== Generating today's meal plans ===`);
  for (const meal of meals) {
    try {
      console.log(`\nProcessing ${meal}...`);
      const mealPlan = await generateMealPlanResponse(user_query, meal);
      mealPlans[meal] = mealPlan;
      console.log(`✓ Successfully generated ${meal} meal plan`);
    } catch (error: any) {
      console.error(`✗ Failed to generate ${meal}:`, error.message);
      throw error;
    }
  }

  console.log(`\n=== Generating tomorrow's meal plans ===`);
  for (const meal of meals2) {
    try {
      console.log(`\nProcessing ${meal}...`);
      const mealPlan = await generateMealPlanResponse(user_query, meal, false);
      mealPlans2[meal] = mealPlan;
      console.log(`✓ Successfully generated ${meal} meal plan`);
    } catch (error: any) {
      console.error(`✗ Failed to generate ${meal}:`, error.message);
      throw error;
    }
  }

  console.log(`\n=== Meal Plans Generated ===`);
  console.log(`Today:`, Object.keys(mealPlans));
  console.log(`Tomorrow:`, Object.keys(mealPlans2));

  // Update user with meal plan
  console.log(`\n=== Updating database ===`);
  await prisma.user.update({
    where: { username: username },
    data: { 
      mealPlan: mealPlans,
      mealPlanPopulated: false
    }
  });

  await prisma.user.update({
    where: { username: username },
    data: { 
      nextMealPlan: mealPlans2,
      mealPlanPopulated: false
    }
  });

  console.log(`✓ Database updated successfully`);

  return mealPlans;
}

// Main test function
async function main() {
  const username = process.argv[2];
  
  if (!username) {
    console.error("Usage: npx ts-node backend/src/Meal-Plan/test-meal-generation.ts <username>");
    console.error("Example: npx ts-node backend/src/Meal-Plan/test-meal-generation.ts testuser@example.com");
    process.exit(1);
  }

  try {
    console.log("Starting meal plan generation test...");
    console.log(`Testing with username: ${username}`);
    
    const result = await generateMealPlanForUser(username);
    
    console.log("\n=== TEST COMPLETED SUCCESSFULLY ===");
    console.log(`Generated meal plans:`, Object.keys(result));
    
  } catch (error: any) {
    console.error("\n=== TEST FAILED ===");
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
