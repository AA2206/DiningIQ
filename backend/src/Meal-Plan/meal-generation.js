import fs from "fs"; 
import OpenAI from "openai";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

const openai = new OpenAI();

const UNAVAILABLE_MEAL_CARD = {
    Meal_Option: "No Recommendations Available",
    Description: "Meal recommendations are currently unavailable. Please try again later.",
    Entrees: []
};

const DINING_HALL_KEYS = [
    "Yahentamitisi_Dining_Hall",
    "South_Campus_Dining_Hall",
    "North_251_Dining_Hall"
];

function buildUnavailableMealSlot() {
    return Object.fromEntries(
        DINING_HALL_KEYS.map((hall) => [hall, [{ ...UNAVAILABLE_MEAL_CARD }]])
    );
}

function buildUnavailableDayPlan(meals) {
    const plan = {};
    for (const meal of meals) {
        plan[meal] = buildUnavailableMealSlot();
    }
    return plan;
}

function isQuotaOrRateLimitError(error) {
    const message = String(error?.message || error?.code || error || "").toLowerCase();
    return (
        message.includes("quota") ||
        message.includes("rate limit") ||
        message.includes("rate_limit") ||
        message.includes("resource exhausted") ||
        message.includes("too many requests") ||
        message.includes("insufficient_quota") ||
        message.includes("billing") ||
        message.includes("exceeded")
    );
}

function isFailedBatchMealResult(mealPlan) {
    if (!mealPlan || mealPlan.error) return true;
    if (isQuotaOrRateLimitError(mealPlan.error)) return true;
    return false;
}

async function copyNextMealPlanToMealPlan() {
    console.log("=== Copying nextMealPlan to mealPlan ===");
    
    try {
        // Use raw SQL to copy data from nextMealPlan to mealPlan
        // This works even if nextMealPlan isn't in the Prisma schema
        // Copies even if nextMealPlan is null
        const result = await prisma.$executeRaw`
            UPDATE "User"
            SET "mealPlan" = "nextMealPlan"
        `;
        
        console.log(`✓ Copied nextMealPlan to mealPlan for ${result} user(s)`);
        
    } catch (error) {
        // If nextMealPlan column doesn't exist, log and continue
        if (error.message && error.message.includes('column "nextMealPlan" does not exist')) {
            console.log("⚠ nextMealPlan column does not exist, skipping copy operation");
        } else {
            console.error("Error copying nextMealPlan to mealPlan:", error);
            throw error;
        }
    }
    
    console.log("=== Finished copying nextMealPlan ===\n");
}

async function setUnavailableMealPlans(allUsers, meals) {
    const unavailablePlan = buildUnavailableDayPlan(meals);

    for (const user of allUsers) {
        try {
            await prisma.user.update({
                where: { username: user.username },
                data: { nextMealPlan: unavailablePlan, mealPlanPopulated: true }
            });
            console.log(`✓ Set unavailable plan for ${user.username}`);
        } catch (error) {
            console.error(`Error setting unavailable plan for ${user.username}:`, error);
        }
    }
}

async function main() {
    // First, copy data from nextMealPlan to mealPlan
    await copyNextMealPlanToMealPlan();

    const today = new Date();
    const dayOfWeek = (today.getDay() + 1) % 7;
    const meals = (dayOfWeek === 0 || dayOfWeek === 6) ? ["Brunch", "Dinner"] : ["Breakfast", "Lunch", "Dinner"];

    const allUsers = await prisma.user.findMany();

    if (allUsers.length === 0) {
        console.log("No users found, skipping meal generation.");
        return;
    }

    const menuCount = await prisma.uMD_Dining2.count();
    if (menuCount === 0) {
        console.warn("UMD_Dining2 database is empty. Setting unavailable meal plans.");
        await setUnavailableMealPlans(allUsers, meals);
        return;
    }

    const system_prompt = "You are a expert dietition that can gives users meal recommendations based on their dietary preferences and goals."

    const schema = {
      format: {
        type: "json_schema",
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

    const batchData = [];
    /** @type {Record<string, Record<string, object>>} */
    const precomputedByUser = {};

    for (const user_data of allUsers) {
        precomputedByUser[user_data.username] = {};
        const user_query = user_data.username + " is a " + user_data.gender + " who is " + user_data.height + " inches tall, " + user_data.weight + " pounds, and " + user_data.age + " years old. " + 
        "Their goal is to " + user_data.goal + " and they workout " + user_data.frequency + " times a week. They have a " + user_data.diet + " diet and '" + user_data.other + 
        "allergies/dietary restrictions."

        for (const meal of meals) {
            // Determine which meal types to include based on the selected meal type
            let mealFilter;
            if (meal === "Brunch") {
                // Brunch shows: Breakfast + Lunch + Brunch
                mealFilter = { in: ["Brunch", "Breakfast", "Lunch"] };
            } else if (meal === "Breakfast") {
                // Breakfast shows: Breakfast + Brunch
                mealFilter = { in: ["Breakfast", "Brunch"] };
            } else if (meal === "Lunch") {
                // Lunch shows: Lunch + Brunch
                mealFilter = { in: ["Lunch", "Brunch"] };
            } else {
                // Dinner shows: Just Dinner
                mealFilter = meal;
            }
    
            const allMenuData = await prisma.uMD_Dining2.findMany({
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
    
            if (allMenuData.length === 0) {
                console.warn(`No menu for ${user_data.username} / ${meal} — using unavailable placeholder (skipped batch).`);
                precomputedByUser[user_data.username][meal] = buildUnavailableMealSlot();
                continue;
            }

            const menuJson = JSON.stringify(allMenuData); 

            const prompt = "Using the attached dining hall nutrition database generate meal options for the users at all 3 dining halls (South Campus, Yahentamitsi Dining Hall, and 251 North)" +
            "You can either use entrees directly from the database or combine entrees with the same category in the database to create a meal option" +
            "Include the name of the meal option and a detailed description of the meal option" +
            "For each Meal_Option, the 'Entrees' array must contain the exact 'id' and 'entree' name from the database - use them exactly as written, do not modify." + 
            "This is the user's query: " + user_query + 
            "Here is the dining hall menu and nutrition database: " + menuJson

            batchData.push({"custom_id": user_data.username + "_" + meal, "method": "POST", "url": "/v1/responses", "body": {"model": "gpt-5-mini", "instructions": system_prompt, "input": prompt, "text": schema}})
        }
    }

    // Nothing to send to OpenAI — save placeholders + any precomputed meals only
    if (batchData.length === 0) {
        console.warn("No batch requests to submit (all meals empty or skipped). Saving merged plans.");
        await saveMealPlansToDatabase(allUsers, meals, {}, precomputedByUser);
        return;
    }

    const batchInput = batchData.map(obj => JSON.stringify(obj)).join("\n") + "\n";

    fs.writeFileSync("batchinput.jsonl", batchInput, "utf8");

    try {
        const file = await openai.files.create({
            file: fs.createReadStream("batchinput.jsonl"),
            purpose: "batch"
        });

        const batch = await openai.batches.create({input_file_id: file.id, endpoint: "/v1/responses", completion_window: "24h"});

        console.log(`Batch created with ID: ${batch.id}`);

        const mealPlansByUser = await checkBatchStatusAndRetrieveResults(openai, batch.id);

        if (mealPlansByUser) {
            await saveMealPlansToDatabase(allUsers, meals, mealPlansByUser, precomputedByUser);
        } else {
            console.warn("Batch returned no results. Setting unavailable meal plans.");
            await setUnavailableMealPlans(allUsers, meals);
        }
    } catch (error) {
        console.error("OpenAI API error:", error.message || error);
        if (isQuotaOrRateLimitError(error)) {
            console.warn("Quota/rate limit during batch submit — using unavailable meal plans.");
        }
        await setUnavailableMealPlans(allUsers, meals);
    }
}

async function saveMealPlansToDatabase(allUsers, meals, mealPlansByUser, precomputedByUser = {}) {
    console.log("\n=== Saving Meal Plans to Database ===");

    for (const user of allUsers) {
        const username = user.username;

        try {
            const batchMeals = mealPlansByUser[username] || {};
            const precomputed = precomputedByUser[username] || {};
            const mergedPlan = {};
            let generatedCount = 0;
            let placeholderCount = 0;

            for (const mealType of meals) {
                if (precomputed[mealType]) {
                    mergedPlan[mealType] = precomputed[mealType];
                    placeholderCount++;
                } else if (batchMeals[mealType] && !isFailedBatchMealResult(batchMeals[mealType])) {
                    mergedPlan[mealType] = batchMeals[mealType];
                    generatedCount++;
                } else {
                    if (batchMeals[mealType]?.error) {
                        const errMsg = batchMeals[mealType].error?.message || JSON.stringify(batchMeals[mealType].error);
                        console.warn(`Batch failed for ${username} / ${mealType}: ${errMsg}`);
                    } else if (!batchMeals[mealType]) {
                        console.warn(`Missing batch result for ${username} / ${mealType}`);
                    }
                    mergedPlan[mealType] = buildUnavailableMealSlot();
                    placeholderCount++;
                }
            }

            await prisma.user.update({
                where: { username },
                data: {
                    nextMealPlan: mergedPlan,
                    mealPlanPopulated: true
                }
            });

            console.log(
                `✓ Saved meal plan for ${username} (${generatedCount} generated, ${placeholderCount} placeholder)`
            );
        } catch (error) {
            console.error(`Error saving meal plan for ${username}:`, error);
        }
    }

    console.log("=== Finished Saving Meal Plans ===\n");
}

function processBatchResults(fileContents) {
    // Parse the JSONL file
    const lines = fileContents.trim().split('\n');
    const resultsByUser = {};
    
    for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
            const result = JSON.parse(line);
            const customId = result.custom_id;
            
            // Parse custom_id format: "username_meal"
            // Handle cases where username might contain underscores
            const lastUnderscoreIndex = customId.lastIndexOf('_');
            if (lastUnderscoreIndex === -1) {
                console.warn(`Invalid custom_id format: ${customId}`);
                continue;
            }
            
            const username = customId.substring(0, lastUnderscoreIndex);
            const mealType = customId.substring(lastUnderscoreIndex + 1);
            
            // Initialize user object if it doesn't exist
            if (!resultsByUser[username]) {
                resultsByUser[username] = {};
            }
            
            // Extract the meal plan data from the nested response structure
            if (result.response && result.response.status_code === 200 && result.response.body) {
                const responseBody = result.response.body;
                
                // Navigate through: body.output[].content[].text
                if (responseBody.output && Array.isArray(responseBody.output)) {
                    for (const outputItem of responseBody.output) {
                        if (outputItem.type === "message" && outputItem.content) {
                            for (const contentItem of outputItem.content) {
                                if (contentItem.type === "output_text" && contentItem.text) {
                                    try {
                                        // Parse the JSON string to get the actual meal plan object
                                        const mealPlanData = JSON.parse(contentItem.text);
                                        resultsByUser[username][mealType] = mealPlanData;
                                        break; // Found the meal plan, move to next result
                                    } catch (parseError) {
                                        console.error(`Error parsing meal plan JSON for ${customId}:`, parseError);
                                    }
                                }
                            }
                        }
                    }
                } else if (responseBody.error) {
                    console.error(`Error for ${customId}:`, responseBody.error);
                    resultsByUser[username][mealType] = { error: responseBody.error };
                }
            } else if (result.response && result.response.status_code !== 200) {
                console.error(`Non-200 status for ${customId}:`, result.response.status_code);
                const err = result.response.body?.error || { message: `HTTP ${result.response.status_code}` };
                resultsByUser[username][mealType] = { error: err };
            } else {
                console.warn(`No valid response found for ${customId}`);
                resultsByUser[username][mealType] = { error: { message: "No valid response in batch output" } };
            }
            
        } catch (error) {
            console.error(`Error parsing line: ${line.substring(0, 100)}...`, error);
        }
    }
    
    return resultsByUser;
}

async function checkBatchStatusAndRetrieveResults(openai, batchId) {
    const maxWaitTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const pollInterval = 5000; // Check every 5 seconds
    const startTime = Date.now();
    let attempts = 0;
    
    while (Date.now() - startTime < maxWaitTime) {
        const batch = await openai.batches.retrieve(batchId);
        const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
        
        console.log(`Batch status: ${batch.status} (attempt ${attempts + 1}, elapsed: ${elapsedMinutes} minutes)`);
        
        if (batch.status === "completed") {
            console.log("Batch completed! Retrieving results...");
            
            if (batch.output_file_id) {
                const fileResponse = await openai.files.content(batch.output_file_id);
                const fileContents = await fileResponse.text();
                
                // Parse results and create meal plan objects per user
                const mealPlansByUser = processBatchResults(fileContents);
                
                console.log("\n=== Meal Plans by User ===");
                console.log(JSON.stringify(mealPlansByUser, null, 2));
                console.log("====================\n");
                
                // Optionally save to file
                fs.writeFileSync("batch_output.jsonl", fileContents, "utf8");
                fs.writeFileSync("meal_plans_by_user.json", JSON.stringify(mealPlansByUser, null, 2), "utf8");
                console.log("Results saved to batch_output.jsonl and meal_plans_by_user.json");
                
                return mealPlansByUser;
            } else {
                console.log("No output file ID found in batch object");
                console.log(`Request counts: ${batch.request_counts?.total} total, ${batch.request_counts?.completed} completed, ${batch.request_counts?.failed} failed`);
                
                // Check for error file
                if (batch.error_file_id) {
                    console.log(`\nRetrieving error file: ${batch.error_file_id}`);
                    const errorFileResponse = await openai.files.content(batch.error_file_id);
                    const errorContents = await errorFileResponse.text();
                    
                    console.log("\n=== Batch Errors ===");
                    console.log(errorContents);
                    console.log("====================\n");
                    
                    // Save error file for review
                    fs.writeFileSync("batch_errors.jsonl", errorContents, "utf8");
                    console.log("Errors also saved to batch_errors.jsonl");
                }
                
                return null;
            }
        } else if (batch.status === "failed" || batch.status === "expired" || batch.status === "cancelled") {
            console.error(`Batch ended with status: ${batch.status}`);
            if (batch.errors) {
                console.error("Errors:", batch.errors);
            }
            return null;
        } else if (batch.status === "validating" || batch.status === "in_progress" || batch.status === "finalizing" || batch.status === "cancelling") {
            // Continue polling
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            attempts++;
        } else {
            console.warn(`Unknown batch status: ${batch.status}`);
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            attempts++;
        }
    }
    
    const elapsedHours = (Date.now() - startTime) / (60 * 60 * 1000);
    console.error(`Max wait time reached (${elapsedHours.toFixed(2)} hours). Batch may still be processing or may have expired.`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
});