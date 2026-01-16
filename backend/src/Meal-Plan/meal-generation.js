import fs from "fs"; 
import OpenAI from "openai";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

const openai = new OpenAI(); 

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

async function main() {
    // First, copy data from nextMealPlan to mealPlan
    await copyNextMealPlanToMealPlan();
    
    const today = new Date();
    const dayOfWeek = (today.getDay() + 1) % 7;
    const meals = (dayOfWeek === 0 || dayOfWeek === 6) ? ["Brunch", "Dinner"] : ["Breakfast", "Lunch", "Dinner"];

    const allUsers = await prisma.user.findMany();

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

    const batchData = []

    for (const user_data of allUsers) {
        const user_query = user_data.username + " is a " + user_data.gender + " who is " + user_data.height + " inches tall, " + user_data.weight + " pounds, and " + user_data.age + " years old. " + 
        "Their goal is to " + user_data.goal + " and they workout " + user_data.frequency + " times a week. They have a " + user_data.diet + " diet and '" + user_data.other + 
        "allergies/dietary restrictions."

        for (const meal of meals) {
            const mealFilter = meal === "Brunch" ? { in: ["Brunch", "Breakfast", "Lunch"] } : meal;
    
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
    
            const menuJson = JSON.stringify(allMenuData); 

            const prompt = "Using the attached dining hall nutrition database generate meal options for the users at all 3 dining halls (South Campus, Yahentamitsi Dining Hall, and 251 North)" +
            "You can either use entrees directly from the database or combine entrees with the same category in the database to create a meal option" +
            "Include the name of the meal option and a detailed description of the meal option" +
            "For each Meal_Option, the 'Entrees' array must contain the exact 'id' and 'entree' name from the database - use them exactly as written, do not modify." + 
            "This is the user's query: " + user_query + 
            "Here is the dining hall menu and nutrition database: " + menuJson

            batchData.push({"custom_id": user_data.username + "_" + meal, "method": "POST", "url": "/v1/responses", "body": {"model": "gpt-5", "instructions": system_prompt, "input": prompt, "text": schema}})
        }
    }

    const batchInput = batchData.map(obj => JSON.stringify(obj)).join("\n") + "\n"; 

    fs.writeFileSync("batchinput.jsonl", batchInput, "utf8"); 

    const file = await openai.files.create({
        file: fs.createReadStream("batchinput.jsonl"),
        purpose: "batch"
    })

    const batch = await openai.batches.create({input_file_id: file.id, endpoint: "/v1/responses", completion_window: "24h"})
    
    console.log(`Batch created with ID: ${batch.id}`);
    
    // Check batch status and retrieve results when completed
    const mealPlansByUser = await checkBatchStatusAndRetrieveResults(openai, batch.id);
    
    // Save meal plans to database
    if (mealPlansByUser) {
        await saveMealPlansToDatabase(mealPlansByUser);
    }
}

async function saveMealPlansToDatabase(mealPlansByUser) {
    console.log("\n=== Saving Meal Plans to Database ===");
    
    for (const [username, mealPlanData] of Object.entries(mealPlansByUser)) {
        try {
            // Check if user exists
            const user = await prisma.user.findUnique({
                where: { username: username }
            });
            
            if (!user) {
                console.warn(`User ${username} not found in database, skipping...`);
                continue;
            }
            
            // Filter out meal plans that have errors
            const validMealPlanData = {};
            for (const [mealType, mealPlan] of Object.entries(mealPlanData)) {
                if (mealPlan && !mealPlan.error) {
                    validMealPlanData[mealType] = mealPlan;
                } else {
                    console.warn(`Skipping ${mealType} for ${username} due to error`);
                }
            }
            
            // Only update if we have at least one valid meal plan
            if (Object.keys(validMealPlanData).length > 0) {
                await prisma.user.update({
                    where: { username: username },
                    data: {
                        nextMealPlan: validMealPlanData,
                        mealPlanPopulated: true
                    }
                });
                
                console.log(`✓ Saved meal plan for ${username} (${Object.keys(validMealPlanData).length} meals: ${Object.keys(validMealPlanData).join(", ")})`);
            } else {
                console.warn(`No valid meal plans found for ${username}, skipping database update`);
            }
            
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
                    // Handle errors
                    console.error(`Error for ${customId}:`, responseBody.error);
                    resultsByUser[username][mealType] = { error: responseBody.error };
                }
            } else if (result.response && result.response.status_code !== 200) {
                console.error(`Non-200 status for ${customId}:`, result.response.status_code);
                if (result.response.body && result.response.body.error) {
                    resultsByUser[username][mealType] = { error: result.response.body.error };
                }
            } else {
                console.warn(`No valid response found for ${customId}`);
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