import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

async function copyDiningData() {
    console.log("=== Copying UMD_Dining2 to UMD_Dining ===");
    
    try {
        // Step 1: Delete all data from uMD_Dining
        console.log("Deleting all data from uMD_Dining...");
        const deleteResult = await prisma.uMD_Dining.deleteMany({});
        console.log(`✓ Deleted ${deleteResult.count} records from uMD_Dining`);
        
        // Step 2: Fetch all data from uMD_Dining2
        console.log("Fetching all data from uMD_Dining2...");
        const sourceData = await prisma.uMD_Dining2.findMany();
        console.log(`✓ Found ${sourceData.length} records in uMD_Dining2`);
        
        if (sourceData.length === 0) {
            console.log("No data to copy. Exiting.");
            return;
        }
        
        // Step 3: Copy data to uMD_Dining
        console.log("Copying data to uMD_Dining...");
        
        // Use createMany for better performance (batch insert)
        const batchSize = 1000;
        let copied = 0;
        
        for (let i = 0; i < sourceData.length; i += batchSize) {
            const batch = sourceData.slice(i, i + batchSize);
            
            await prisma.uMD_Dining.createMany({
                data: batch.map(item => ({
                    entree: item.entree,
                    diningHall: item.diningHall,
                    meal: item.meal,
                    dietaryInformation: item.dietaryInformation,
                    category: item.category,
                    totalCalories: item.totalCalories,
                    totalFat: item.totalFat,
                    totalCarbohydrate: item.totalCarbohydrate,
                    saturatedFat: item.saturatedFat,
                    dietaryFiber: item.dietaryFiber,
                    transFat: item.transFat,
                    totalSugars: item.totalSugars,
                    cholesterol: item.cholesterol,
                    sodium: item.sodium,
                    protein: item.protein
                })),
                skipDuplicates: true // Skip if duplicates exist (shouldn't happen after delete)
            });
            
            copied += batch.length;
            console.log(`  Copied ${copied}/${sourceData.length} records...`);
        }
        
        console.log(`✓ Successfully copied ${copied} records from uMD_Dining2 to uMD_Dining`);
        console.log("=== Copy completed successfully ===\n");
        
    } catch (error) {
        console.error("Error copying dining data:", error);
        throw error;
    }
}

async function main() {
    try {
        await copyDiningData();
    } catch (error) {
        console.error("Script failed:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
