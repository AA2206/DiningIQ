// Backend entry point
import { google } from '@ai-sdk/google';
import { PrismaClient } from '@prisma/client';
import { generateObject } from 'ai';
import bcrypt from 'bcrypt';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express'; 
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function modifyMealPlan(user_query: string, meal_plan: any) {
  const allMenuData = await prisma.uMD_Dining.findMany({
      select: {
          id: true,
          entree: true,
          diningHall: true,
          meal: true,
          dietaryInformation: true,
          category: true
      },

  });

  const menuJson = JSON.stringify(allMenuData);
  const existingMealPlanJson = JSON.stringify(meal_plan);

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
    system: "You are an expert dietitian that modifies existing meal plans based on user feedback and preferences.",
    prompt: "You are modifying an EXISTING meal plan based on the user's request. " +
          "Here is the user's modification request: " + user_query + "\n\n" +
          "CURRENT MEAL PLAN (modify this based on the user's request):\n" + existingMealPlanJson + "\n\n" +
          "AVAILABLE MENU DATABASE (use only items from this database):\n" + menuJson + "\n\n" +
          "INSTRUCTIONS:\n" +
          "1. Review the current meal plan above\n" +
          "2. Modify it according to the user's request while maintaining the same structure\n" +
          "3. You can replace, add, or remove meal options based on the user's feedback\n" +
          "4. Use ONLY entrees from the provided database - do not invent new items\n" +
          "5. For each Meal_Option, the 'Entrees' array must contain the exact 'id' and 'entree' name from the database - use them exactly as written, do not modify\n" +
          "6. Maintain meal options for all 3 dining halls (South Campus, Yahentamitsi Dining Hall, and 251 North)\n" +
          "7. Return the complete modified meal plan in the same format as the original",
  });
  
  return mealPlan;
}

// Add this function to backend/src/index.ts (around line 85, after modifyMealPlan)

async function generateMealPlanForUser(username: string) {
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

  // Build user query string
  const user_query = `${username} is a ${user.gender || 'person'} who is ${user.height || 'unknown'} inches tall, ${user.weight || 'unknown'} pounds, and ${user.age || 'unknown'} years old. ` +
    `Their goal is to ${user.goal || 'maintain health'} and they workout ${user.frequency || '0'} times a week. They have a ${user.diet || 'standard'} diet and '${user.other || 'no'} allergies/dietary restrictions.`;

  const today = new Date();
  const dayOfWeek = today.getDay();
  const tomorrowDayOfWeek = (dayOfWeek + 1) % 7;
  
  // Determine meals for today and tomorrow
  const meals = (dayOfWeek === 0 || dayOfWeek === 6) ? ["Brunch", "Dinner"] : ["Breakfast", "Lunch", "Dinner"];
  const meals2 = (tomorrowDayOfWeek === 0 || tomorrowDayOfWeek === 6) ? ["Brunch", "Dinner"] : ["Breakfast", "Lunch", "Dinner"];
    
  // Generate today's meal plans (using uMD_Dining) and tomorrow's meal plans (using uMD_Dining2) in parallel
  const todayPromises = meals.map(meal => generateMealPlanResponse(user_query, meal, true));
  const tomorrowPromises = meals2.map(meal => generateMealPlanResponse(user_query, meal, false));
  
  // Execute both sets of promises in parallel
  const [todayResults, tomorrowResults] = await Promise.all([
    Promise.all(todayPromises),
    Promise.all(tomorrowPromises)
  ]);

  // Build meal plan objects
  const mealPlans: Record<string, any> = {};
  meals.forEach((meal, index) => {
    mealPlans[meal] = todayResults[index];
  });

  const mealPlans2: Record<string, any> = {};
  meals2.forEach((meal, index) => {
    mealPlans2[meal] = tomorrowResults[index];
  });

  // Update user with both meal plans
  await prisma.user.update({
    where: { username: username },
    data: { 
      mealPlan: mealPlans,
      nextMealPlan: mealPlans2,
      mealPlanPopulated: false
    }
  });

  return mealPlans;
}

async function generateMealPlanResponse(user_query: string, meal_type: string, today: boolean = true) {
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

  // Use conditional logic directly to avoid TypeScript union type issues
  const allMenuData = today 
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

  const menuJson = JSON.stringify(allMenuData);

  const mealPlanSchema = z.object({
    Yahentamitisi_Dining_Hall: z.array(
      z.object({
        Meal_Option: z.string(),
        Description: z.string(),
        Entrees: z.array(z.object({ id: z.number(), entree: z.string() })), 
        Calories: z.number(), 
        Protein: z.number()
      })
    ),
    South_Campus_Dining_Hall: z.array(
      z.object({
        Meal_Option: z.string(),
        Description: z.string(),
        Entrees: z.array(z.object({ id: z.number(), entree: z.string() })),
        Calories: z.number(), 
        Protein: z.number()
      })
    ),
    North_251_Dining_Hall: z.array(
      z.object({
        Meal_Option: z.string(),
        Description: z.string(),
        Entrees: z.array(z.object({ id: z.number(), entree: z.string() })), 
        Calories: z.number(), 
        Protein: z.number() 
      })
    )
  });

  try {
    const { object: mealPlan } = await generateObject({
      model: google('gemini-2.5-flash'), 
      schema: mealPlanSchema,
      system: "You are an expert dietitian that gives users meal recommendations based on their dietary preferences and goals.",
      prompt: "Using the attached dining hall nutrition database, generate meal options for the user at all 3 dining halls (South Campus, Yahentamitisi Dining Hall, and 251 North). " +
        "You can either use entrees directly from the database or combine entrees with the same category in the database to create a meal option. " +
        "Include the name of the meal option and a relatively concise description of the meal option. " +
        "For each Meal_Option, the 'Entrees' array must contain the exact 'id' and 'entree' name from the database - use them exactly as written, do not modify. " +
        "For each Meal_Option, calculate the Calories and Protein by summing up the individual 'totalCalories' and 'protein' values of each entree in the 'Entrees' array. You can find these individual 'totalCalories' and 'protein' values in the database included below. " +
        "This is the user's query: " + user_query + " " +
        "Here is the dining hall menu and nutrition database: " + menuJson,
    });

    return mealPlan;
  } catch (error) {
    console.error('Error generating meal plan:', error);
    throw error;
  }
}

// Health check endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// ========== AUTH ROUTES ==========

// POST /register
app.post('/register', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    // Check if user exists
    const userExists = await prisma.user.findUnique({
      where: { username: username }
    });

    if (userExists != null) {
      return res.status(400).json({ error: 'Username already registered.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        username: username,
        passcode: hashedPassword
      }
    });

    // Generate JWT token
    const token = jwt.sign(
      { username: user.username, id: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    return res.status(201).json({ token, userId: user.id });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /login
app.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { username: username }
    });

    if (!user) {
      return res.status(400).json({ error: 'Username not found' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passcode);

    if (isPasswordValid) {
      // TODO: Implement initializeEntrees function
      // if (user.mealPlanPopulated === false) {
      //   const response = await initializeEntrees(username);
      //   if (!(response.success)) {
      //     return res.status(401).json({ error: 'Meal plan failed to generate' });
      //   }
      // }

      const token = jwt.sign(
        { username: user.username, id: user.id },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );

      return res.status(200).json({ token, userId: user.id });
    } else {
      return res.status(400).json({ error: 'Invalid password' });
    }
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /google-auth - Handle Google Sign-In
app.post('/google-auth', async (req: Request, res: Response) => {
  const { email } = req.body;
  // Note: name and googleId can be extracted from req.body if needed for user profiles

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Check if user exists with this email as username
    let user = await prisma.user.findUnique({
      where: { username: email }
    });

    let isNewUser = false;

    if (!user) {
      // Create new user for Google sign-in
      // Generate a random secure password (user won't need it - they'll always use Google)
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = await prisma.user.create({
        data: {
          username: email,
          passcode: hashedPassword,
        }
      });
      isNewUser = true;
    }

    // Generate JWT token
    const token = jwt.sign(
      { username: user.username, id: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    return res.status(200).json({ 
      token, 
      userId: user.id,
      isNewUser,  // Frontend can use this to redirect to onboarding
    });
  } catch (err) {
    console.error('Google auth error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /apple-auth - Handle Apple Sign-In
app.post('/apple-auth', async (req: Request, res: Response) => {
  const { appleId } = req.body; // email is optional and not used for identification

  if (!appleId) {
    return res.status(400).json({ error: 'Apple ID is required' });
  }

  try {
    // Always use Apple ID as the primary identifier
    // This is consistent across sign-ins, even when "Hide My Email" is used
    const username = `apple_${appleId}`;
    
    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { username: username }
    });

    let isNewUser = false;

    if (!user) {
      // Create new user for Apple sign-in
      // Generate a random secure password (user won't need it - they'll always use Apple)
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = await prisma.user.create({
        data: {
          username: username,
          passcode: hashedPassword,
        }
      });
      isNewUser = true;
    }

    // Generate JWT token
    const token = jwt.sign(
      { username: user.username, id: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    return res.status(200).json({ 
      token, 
      userId: user.id,
      isNewUser,  // Frontend can use this to redirect to onboarding
    });
  } catch (err) {
    console.error('Apple auth error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ========== USER INFO ROUTES ==========

// JWT Authentication Middleware
const authenticateJWT = (req: Request, res: Response, next: express.NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1]; // Bearer TOKEN

    jwt.verify(token, process.env.JWT_SECRET!, (err: any, user: any) => {
      if (err) {
        res.status(403).json({ error: 'Invalid or expired token' });
        return;
      }
      (req as any).user = user; // { username, id }
      next();
    });
  } else {
    res.status(401).json({ error: 'Authorization header missing' });
  }
};

// GET /user-profile - Get user profile data
app.get('/user-profile', authenticateJWT, async (req: Request, res: Response) => {
  const username = (req as any).user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Username missing from token' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { username: username },
      select: {
        username: true,
        gender: true,
        frequency: true,
        height: true,
        weight: true,
        age: true,
        goal: true,
        diet: true,
        other: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Map enum values back to display values
    const genderMap: Record<string, string> = {
      'MALE': 'Male',
      'FEMALE': 'Female',
      'OTHER': 'Other'
    };

    const goalMap: Record<string, string> = {
      'BUILD_MUSCLE': 'Build Muscle',
      'LOSE_WEIGHT': 'Get Lean',
      'MAINTAIN': 'Improve Fitness'
    };

    const dietMap: Record<string, string> = {
      'OMNIVORE': 'Classic',
      'VEGETARIAN': 'Vegetarian',
      'VEGAN': 'Vegan'
    };

    return res.status(200).json({
      username: user.username,
      gender: user.gender ? genderMap[user.gender] || user.gender : null,
      frequency: user.frequency,
      height: user.height,
      weight: user.weight,
      age: user.age,
      goal: user.goal ? goalMap[user.goal] || user.goal : null,
      diet: user.diet ? dietMap[user.diet] || user.diet : null,
      other: user.other,
    });
  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /update-field
app.post('/update-field', authenticateJWT, async (req: Request, res: Response) => {
  const { field, selectedValue } = req.body;
  const username = (req as any).user?.username;

  if (!field || selectedValue === undefined) {
    return res.status(400).json({ error: 'Field and selectedValue are required' });
  }

  if (!username) {
    return res.status(401).json({ error: 'Username missing from token' });
  }

  // Allowed fields for security
  const allowedFields = [
    'gender',
    'frequency',
    'height',
    'weight',
    'age',
    'goal',
    'diet',
    'other',
    'mealPlan',
    'mealPlanPopulated'
  ];

  if (!allowedFields.includes(field)) {
    return res.status(400).json({ error: `Field '${field}' is not allowed to be updated` });
  }

  try {
    let valueToStore = selectedValue;
  
    if (field === 'gender') {
      const genderMap: Record<string, string> = {
        'Male': 'MALE',
        'Female': 'FEMALE',
        'Other': 'OTHER'
      };
      valueToStore = genderMap[selectedValue] || selectedValue;
    } else if (field === 'goal') {
      const goalMap: Record<string, string> = {
        'Build Muscle': 'BUILD_MUSCLE',
        'Get Lean': 'LOSE_WEIGHT',
        'Improve Fitness': 'MAINTAIN'
      };
      valueToStore = goalMap[selectedValue] || selectedValue;
    } else if (field === 'diet') {
      const dietMap: Record<string, string> = {
        'Classic': 'OMNIVORE',
        'Vegetarian': 'VEGETARIAN',
        'Vegan': 'VEGAN',
        'Pescetarian': 'OMNIVORE' // or create PESCATARIAN in enum
      };
      valueToStore = dietMap[selectedValue] || selectedValue;
    }

    await prisma.user.update({
      where: { username: username },
      data: { [field]: valueToStore }
    });

    return res.status(200).json({ message: 'Value updated successfully' });
  } catch (error: any) {
    console.error('Error updating field:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /add-metrics
app.post('/add-metrics', authenticateJWT, async (req: Request, res: Response) => {
  const { height, weight, age } = req.body;
  const username = (req as any).user?.username;

  if (!height || !weight || !age) {
    return res.status(400).json({ error: 'Height, weight, and age are required' });
  }

  if (!username) {
    return res.status(401).json({ error: 'Username missing from token' });
  }

  try {
    // Update all metrics in a single database call (more efficient)
    await prisma.user.update({
      where: { username: username },
      data: {
        height: parseFloat(height),
        weight: parseFloat(weight),
        age: parseInt(age)
      }
    });

    return res.status(200).json({ message: 'Metrics added successfully' });
  } catch (error: any) {
    console.error('Error adding metrics:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/other', authenticateJWT, async (req: Request, res: Response) => {
  const { other } = req.body;
  const username = (req as any).user?.username;

  if (!other) {
    return res.status(400).json({ error: 'Additional allergy/dietary restriction information required' });
  }

  if (!username) {
    return res.status(401).json({ error: 'Username missing from token' });
  }

  try {
    await prisma.user.update({
      where: { username: username },
      data: { other: other }
    });

    return res.status(200).json({ message: 'Value added successfully' });
  } catch (error: any) {
    console.error('Error adding other dietary restrictions/allergies:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/modify-meal-plan', authenticateJWT, async (req: Request, res: Response) => {
  const username = (req as any).user?.username;
  const user_query = req.body.user_query;

  if(!username) {
    return res.status(401).json({ error: 'Username missing from token' });
  }

  try {
    const foundUser = await prisma.user.findUnique({
      where: { username: username },
      select: {
        mealPlan: true
      }
    });

    if (!foundUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!foundUser.mealPlan) {
      return res.status(404).json({ error: 'No meal plan found. Please generate a meal plan first.' });
    }

    if (!user_query) {
      return res.status(400).json({ error: 'user_query is required' });
    }

    const modifiedMealPlan = await modifyMealPlan(user_query, foundUser.mealPlan);

    await prisma.user.update({
      where: { username: username },
      data: { mealPlan: modifiedMealPlan }
    });

    return res.status(200).json({ message: 'Meal plan updated successfully', mealPlan: modifiedMealPlan });
  } catch (error: any) {
    console.error('Error modifying meal plan:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /generation-status
app.get('/generation-status', authenticateJWT, async (req: Request, res: Response) => {
  const username = (req as any).user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Username missing from token' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        mealPlanGenerating: true,
        mealPlanGeneratedAt: true,
        mealPlan: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      inProgress: user.mealPlanGenerating || false,
      startedAt: user.mealPlanGeneratedAt?.toISOString() || null,
      hasMealPlan: !!user.mealPlan,
    });
  } catch (error: any) {
    console.error('Error checking generation status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /generate-meal-plan
app.post('/generate-meal-plan', authenticateJWT, async (req: Request, res: Response) => {
  const username = (req as any).user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Username missing from token' });
  }

  try {
    // Check if generation is already in progress
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        mealPlanGenerating: true,
        mealPlan: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If meal plan already exists, return it
    if (user.mealPlan) {
      return res.status(200).json({ 
        message: 'Meal plan already exists', 
        mealPlan: user.mealPlan 
      });
    }

    // If generation is already in progress, return status
    if (user.mealPlanGenerating) {
      const userWithTimestamp = await prisma.user.findUnique({
        where: { username },
        select: { mealPlanGeneratedAt: true }
      });
      return res.status(202).json({ 
        message: 'Meal plan generation already in progress',
        inProgress: true,
        startedAt: userWithTimestamp?.mealPlanGeneratedAt?.toISOString() || null
      });
    }

    // Set flag to prevent duplicates and record start time
    await prisma.user.update({
      where: { username },
      data: { 
        mealPlanGenerating: true,
        mealPlanGeneratedAt: new Date()
      }
    });

    // Generate meal plan (this may take ~2 minutes)
    const mealPlan = await generateMealPlanForUser(username);
    
    // Clear flag and save meal plan
    await prisma.user.update({
      where: { username },
      data: { 
        mealPlan: mealPlan,
        mealPlanGenerating: false,
      }
    });

    return res.status(200).json({ message: 'Meal plan generated successfully', mealPlan });
  } catch (error: any) {
    console.error('Error generating meal plan:', error);
    
    // Clear flag on error
    try {
      await prisma.user.update({
        where: { username: (req as any).user?.username },
        data: { mealPlanGenerating: false }
      });
    } catch (updateError) {
      console.error('Error clearing generation flag:', updateError);
    }
    
    if (error.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /get-meal-plan
app.get('/get-meal-plan', authenticateJWT, async (req: Request, res: Response) => {
  const username = (req as any).user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Username missing from token' });
  }

  try {
    const foundUser = await prisma.user.findUnique({
      where: { username: username },
      select: {
        mealPlan: true
      }
    });

    if (!foundUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!foundUser.mealPlan) {
      return res.status(204).json({ message: 'No meal plan found' });
    }

    return res.status(200).json({ mealPlan: foundUser.mealPlan });
  } catch (error: any) {
    console.error('Error fetching meal plan:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/fetchAllEntrees', authenticateJWT, async (req: Request, res: Response) => {
  const { diningHall, mealType } = req.query;

  if (!diningHall || !mealType) {
    return res.status(400).json({ 
      error: 'diningHall and mealType query parameters are required' 
    });
  }

  // Validate mealType
  const validMealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Brunch'];
  if (!validMealTypes.includes(mealType as string)) {
    return res.status(400).json({ 
      error: `mealType must be one of: ${validMealTypes.join(', ')}` 
    });
  }

  try {
    // Determine which meal types to include based on the selected meal type
    let mealFilter: any;
    
    if (mealType === "Brunch") {
      // Brunch shows: Breakfast + Lunch + Brunch
      mealFilter = { in: ["Brunch", "Breakfast", "Lunch"] as any[] };
    } else if (mealType === "Breakfast") {
      // Breakfast shows: Breakfast + Brunch
      mealFilter = { in: ["Breakfast", "Brunch"] as any[] };
    } else if (mealType === "Lunch") {
      // Lunch shows: Lunch + Brunch
      mealFilter = { in: ["Lunch", "Brunch"] as any[] };
    } else {
      // Dinner shows: Just Dinner
      mealFilter = mealType as any;
    }

    const entrees = await prisma.uMD_Dining.findMany({
      where: {
        diningHall: diningHall as string,
        meal: mealFilter
      },
      select: {
        id: true,
        entree: true,
        totalCalories: true,
        totalFat: true,
        totalCarbohydrate: true,
        protein: true
      },
      orderBy: {
        entree: 'asc'
      }
    });

    return res.status(200).json({ 
      entrees: entrees
    });
  } catch (error: any) {
    console.error('Error fetching entrees:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /fetch-meals
app.get('/fetch-meals', authenticateJWT, async (req: Request, res: Response) => {
  const { date } = req.query;
  const username = (req as any).user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Username missing from token' });
  }

  if (!date) {
    return res.status(400).json({ error: 'date query parameter is required (ISO string)' });
  }

  try {
    // Parse the date and get start/end of day
    const mealDate = new Date(date as string);
    if (isNaN(mealDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use ISO string (e.g., 2024-11-22T00:00:00Z)' });
    }

    const startOfDay = new Date(mealDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(mealDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch all meals for the user on the specified date
    const meals = await prisma.meal.findMany({
      where: {
        username: username,
        date: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      orderBy: {
        meal: 'asc'
      }
    });

    // Group meals by meal type
    const mealsByType: { [key: string]: any[] } = {
      Breakfast: [],
      Lunch: [],
      Dinner: [],
      Brunch: []
    };

    meals.forEach(meal => {
      const mealType = meal.meal as string;
      if (mealsByType[mealType]) {
        mealsByType[mealType].push(meal);
      }
    });

    return res.status(200).json({ 
      date: date,
      meals: mealsByType
    });
  } catch (error: any) {
    console.error('Error fetching meals:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /fetch-meal-stats
app.get('/fetch-meal-stats', authenticateJWT, async (req: Request, res: Response) => {
  const { date, meal } = req.query;
  const username = (req as any).user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Username missing from token' });
  }

  if (!date || !meal) {
    return res.status(400).json({ error: 'date and meal query parameters are required' });
  }

  // Validate mealType
  const validMealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Brunch'];
  if (!validMealTypes.includes(meal as string)) {
    return res.status(400).json({ 
      error: `meal must be one of: ${validMealTypes.join(', ')}` 
    });
  }

  try {
    // Parse the date and get start/end of day
    const mealDate = new Date(date as string);
    if (isNaN(mealDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use ISO string (e.g., 2024-11-22T00:00:00Z)' });
    }

    const startOfDay = new Date(mealDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(mealDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch MealStats for the user, date, and meal type (should be only one)
    const mealStats = await prisma.mealStats.findFirst({
      where: {
        username: username,
        date: {
          gte: startOfDay,
          lte: endOfDay
        },
        meal: meal as any
      }
    });

    // Return macros (or zeros if no stats found)
    const macros = mealStats ? {
      calories: mealStats.calories,
      protein: mealStats.protein,
      fats: mealStats.fats,
      carbs: mealStats.carbs
    } : {
      calories: 0,
      protein: 0,
      fats: 0,
      carbs: 0
    };

    return res.status(200).json({ 
      date: date,
      meal: meal,
      macros: macros
    });
  } catch (error: any) {
    console.error('Error fetching meal stats:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /increase-serving
app.put('/increase-serving', authenticateJWT, async (req: Request, res: Response) => {
  const { mealId } = req.body;
  const username = (req as any).user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Username missing from token' });
  }

  if (!mealId) {
    return res.status(400).json({ error: 'mealId is required' });
  }

  try {
    // Find the meal and verify it belongs to the user
    const meal = await prisma.meal.findFirst({
      where: {
        id: parseInt(mealId),
        username: username
      }
    });

    if (!meal) {
      return res.status(404).json({ error: 'Meal not found or does not belong to user' });
    }

    // Increment serving size
    const newServingSize = meal.servingSize + 1;

    // Update the meal's serving size
    const updatedMeal = await prisma.meal.update({
      where: { id: meal.id },
      data: {
        servingSize: newServingSize
      }
    });

    // Get base macros (for 1 serving) from the meal
    const baseCalories = meal.totalCalories;
    const baseProtein = meal.totalProtein;
    const baseCarbs = meal.totalCarbs;
    const baseFats = meal.totalFats;

    // Calculate date range for finding MealStats
    const mealDate = new Date(meal.date);
    const startOfDay = new Date(mealDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(mealDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Find or create MealStats for this date/meal type
    const existingStats = await prisma.mealStats.findFirst({
      where: {
        username: username,
        date: {
          gte: startOfDay,
          lte: endOfDay
        },
        meal: meal.meal
      }
    });

    if (existingStats) {
      // Update existing stats by adding base macros
      await prisma.mealStats.update({
        where: { id: existingStats.id },
        data: {
          calories: existingStats.calories + baseCalories,
          protein: existingStats.protein + baseProtein,
          fats: existingStats.fats + baseFats,
          carbs: existingStats.carbs + baseCarbs
        }
      });
    } else {
      // Create new MealStats record with base macros
      await prisma.mealStats.create({
        data: {
          username: username,
          date: mealDate,
          meal: meal.meal,
          calories: baseCalories,
          protein: baseProtein,
          fats: baseFats,
          carbs: baseCarbs
        }
      });
    }

    return res.status(200).json({ 
      meal: updatedMeal,
      message: 'Serving size increased successfully' 
    });
  } catch (error: any) {
    console.error('Error increasing serving:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Meal not found' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /decrease-serving
app.put('/decrease-serving', authenticateJWT, async (req: Request, res: Response) => {
  const { mealId } = req.body;
  const username = (req as any).user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Username missing from token' });
  }

  if (!mealId) {
    return res.status(400).json({ error: 'mealId is required' });
  }

  try {
    // Find the meal and verify it belongs to the user
    const meal = await prisma.meal.findFirst({
      where: {
        id: parseInt(mealId),
        username: username
      }
    });

    if (!meal) {
      return res.status(404).json({ error: 'Meal not found or does not belong to user' });
    }

    // Check if serving size is already 1 - should use remove endpoint instead
    if (meal.servingSize <= 1) {
      return res.status(400).json({ 
        error: 'Serving size is already 1. Use the remove-meal endpoint to delete the meal.' 
      });
    }

    // Decrease serving size by 1
    const newServingSize = meal.servingSize - 1;

    // Update the meal's serving size
    const updatedMeal = await prisma.meal.update({
      where: { id: meal.id },
      data: {
        servingSize: newServingSize
      }
    });

    // Get base macros (for 1 serving) from the meal
    const baseCalories = meal.totalCalories;
    const baseProtein = meal.totalProtein;
    const baseCarbs = meal.totalCarbs;
    const baseFats = meal.totalFats;

    // Calculate date range for finding MealStats
    const mealDate = new Date(meal.date);
    const startOfDay = new Date(mealDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(mealDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Find MealStats for this date/meal type (should exist if meal exists)
    const existingStats = await prisma.mealStats.findFirst({
      where: {
        username: username,
        date: {
          gte: startOfDay,
          lte: endOfDay
        },
        meal: meal.meal
      }
    });

    if (existingStats) {
      // Update stats by subtracting base macros
      // Ensure values don't go negative
      await prisma.mealStats.update({
        where: { id: existingStats.id },
        data: {
          calories: Math.max(0, existingStats.calories - baseCalories),
          protein: Math.max(0, existingStats.protein - baseProtein),
          fats: Math.max(0, existingStats.fats - baseFats),
          carbs: Math.max(0, existingStats.carbs - baseCarbs)
        }
      });
    } else {
      // This shouldn't happen if data is consistent, but handle it gracefully
      console.warn(`MealStats not found for meal ${mealId} - stats may be inconsistent`);
    }

    return res.status(200).json({ 
      meal: updatedMeal,
      message: 'Serving size decreased successfully' 
    });
  } catch (error: any) {
    console.error('Error decreasing serving:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Meal not found' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /remove-meal
app.delete('/remove-meal', authenticateJWT, async (req: Request, res: Response) => {
  // Try to get mealId from body first, then query params as fallback
  const mealId = req.body?.mealId || req.query?.mealId;
  const username = (req as any).user?.username;

  console.log('Remove meal request:', { mealId, username, body: req.body, query: req.query });

  if (!username) {
    return res.status(401).json({ error: 'Username missing from token' });
  }

  if (!mealId) {
    return res.status(400).json({ error: 'mealId is required' });
  }

  try {
    // Find the meal and verify it belongs to the user
    const meal = await prisma.meal.findFirst({
      where: {
        id: parseInt(mealId),
        username: username
      }
    });

    if (!meal) {
      return res.status(404).json({ error: 'Meal not found or does not belong to user' });
    }

    // Calculate total macros for the meal (base macros * serving size)
    const totalCalories = meal.totalCalories * meal.servingSize;
    const totalProtein = meal.totalProtein * meal.servingSize;
    const totalCarbs = meal.totalCarbs * meal.servingSize;
    const totalFats = meal.totalFats * meal.servingSize;

    // Calculate date range for finding MealStats
    const mealDate = new Date(meal.date);
    const startOfDay = new Date(mealDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(mealDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Find MealStats for this date/meal type
    const existingStats = await prisma.mealStats.findFirst({
      where: {
        username: username,
        date: {
          gte: startOfDay,
          lte: endOfDay
        },
        meal: meal.meal
      }
    });

    // Delete the meal record
    await prisma.meal.delete({
      where: { id: meal.id }
    });

    // Update MealStats by subtracting the removed meal's macros
    if (existingStats) {
      // Calculate new values (ensure they don't go negative)
      const newCalories = Math.max(0, existingStats.calories - totalCalories);
      const newProtein = Math.max(0, existingStats.protein - totalProtein);
      const newFats = Math.max(0, existingStats.fats - totalFats);
      const newCarbs = Math.max(0, existingStats.carbs - totalCarbs);

      // If all macros are 0, we could delete the MealStats record, but keeping it is fine
      await prisma.mealStats.update({
        where: { id: existingStats.id },
        data: {
          calories: newCalories,
          protein: newProtein,
          fats: newFats,
          carbs: newCarbs
        }
      });
    } else {
      // This shouldn't happen if data is consistent, but handle it gracefully
      console.warn(`MealStats not found for meal ${mealId} - stats may be inconsistent`);
    }

    return res.status(200).json({ 
      message: 'Meal removed successfully' 
    });
  } catch (error: any) {
    console.error('Error removing meal:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Meal not found' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /update-meal
app.put('/update-meal', authenticateJWT, async (req: Request, res: Response) => {
  const { mealId, mealName, mealDescription, entrees } = req.body;
  const username = (req as any).user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Username missing from token' });
  }

  if (!mealId) {
    return res.status(400).json({ error: 'mealId is required' });
  }

  if (!entrees || !Array.isArray(entrees) || entrees.length === 0) {
    return res.status(400).json({ error: 'entrees (non-empty array) is required' });
  }

  try {
    // Find the existing meal and verify it belongs to the user
    const existingMeal = await prisma.meal.findFirst({
      where: {
        id: parseInt(mealId),
        username: username
      }
    });

    if (!existingMeal) {
      return res.status(404).json({ error: 'Meal not found or does not belong to user' });
    }

    // Calculate old total macros (for MealStats adjustment) - using existing servingSize
    const oldTotalCalories = existingMeal.totalCalories * existingMeal.servingSize;
    const oldTotalProtein = existingMeal.totalProtein * existingMeal.servingSize;
    const oldTotalCarbs = existingMeal.totalCarbs * existingMeal.servingSize;
    const oldTotalFats = existingMeal.totalFats * existingMeal.servingSize;

    // Fetch new entree data from UMD_Dining table using IDs
    const entreeIds = entrees.map((e: any) => {
      // Handle both { id: 1 } and just 1 formats
      return typeof e === 'object' ? e.id : e;
    });

    const entreeData = await prisma.uMD_Dining.findMany({
      where: {
        id: { in: entreeIds }
      },
      select: {
        id: true,
        entree: true,
        totalCalories: true,
        totalFat: true,
        totalCarbohydrate: true,
        protein: true
      }
    });

    // Validate that all entrees were found
    if (entreeData.length !== entreeIds.length) {
      const foundIds = entreeData.map(e => e.id);
      const missingIds = entreeIds.filter((id: number) => !foundIds.includes(id));
      return res.status(400).json({ 
        error: `Some entrees not found. Missing IDs: ${missingIds.join(', ')}` 
      });
    }

    // Calculate new base macros for ONE serving
    const newBaseCalories = entreeData.reduce((sum, e) => sum + e.totalCalories, 0);
    const newBaseProtein = entreeData.reduce((sum, e) => sum + e.protein, 0);
    const newBaseCarbs = entreeData.reduce((sum, e) => sum + e.totalCarbohydrate, 0);
    const newBaseFats = entreeData.reduce((sum, e) => sum + e.totalFat, 0);

    // Calculate new total macros (for MealStats) - using existing servingSize
    const newTotalCalories = newBaseCalories * existingMeal.servingSize;
    const newTotalProtein = newBaseProtein * existingMeal.servingSize;
    const newTotalCarbs = newBaseCarbs * existingMeal.servingSize;
    const newTotalFats = newBaseFats * existingMeal.servingSize;

    // Prepare entrees array for storage (with id and entree name)
    const entreesArray = entreeData.map(e => ({
      id: e.id,
      entree: e.entree
    }));

    // Update the meal record (keeping existing servingSize)
    const updatedMeal = await prisma.meal.update({
      where: { id: existingMeal.id },
      data: {
        mealName: mealName || existingMeal.mealName,
        mealDescription: mealDescription !== undefined ? mealDescription : existingMeal.mealDescription,
        entrees: entreesArray,
        totalCalories: newBaseCalories,      // Store base (1 serving)
        totalProtein: newBaseProtein,        // Store base (1 serving)
        totalCarbs: newBaseCarbs,            // Store base (1 serving)
        totalFats: newBaseFats               // Store base (1 serving)
      }
    });

    // Calculate date range for finding MealStats
    const mealDate = new Date(existingMeal.date);
    const startOfDay = new Date(mealDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(mealDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Find MealStats for this date/meal type
    const existingStats = await prisma.mealStats.findFirst({
      where: {
        username: username,
        date: {
          gte: startOfDay,
          lte: endOfDay
        },
        meal: existingMeal.meal,
      }
    });

    if (existingStats) {
      // Update MealStats by adjusting for the difference
      // New stats = Old stats - Old meal totals + New meal totals
      await prisma.mealStats.update({
        where: { id: existingStats.id },
        data: {
          calories: Math.max(0, existingStats.calories - oldTotalCalories + newTotalCalories),
          protein: Math.max(0, existingStats.protein - oldTotalProtein + newTotalProtein),
          fats: Math.max(0, existingStats.fats - oldTotalFats + newTotalFats),
          carbs: Math.max(0, existingStats.carbs - oldTotalCarbs + newTotalCarbs)
        }
      });
    } else {
      // This shouldn't happen if data is consistent, but handle it gracefully
      console.warn(`MealStats not found for meal ${mealId} - creating new stats record`);
      await prisma.mealStats.create({
        data: {
          username: username,
          date: mealDate,
          meal: existingMeal.meal,
          calories: newTotalCalories,
          protein: newTotalProtein,
          fats: newTotalFats,
          carbs: newTotalCarbs
        }
      });
    }

    return res.status(200).json({ 
      meal: updatedMeal,
      message: 'Meal updated successfully' 
    });
  } catch (error: any) {
    console.error('Error updating meal:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Meal not found' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /verify-entrees - Check if entrees exist for a specific meal type before copying a meal (by name)
app.post('/verify-entrees', authenticateJWT, async (req: Request, res: Response) => {
  const { entreeNames, mealType, diningHall } = req.body;

  if (!entreeNames || !Array.isArray(entreeNames) || entreeNames.length === 0) {
    return res.status(400).json({ error: 'entreeNames (non-empty array) is required' });
  }

  if (!mealType) {
    return res.status(400).json({ error: 'mealType is required' });
  }

  if (!diningHall) {
    return res.status(400).json({ error: 'diningHall is required' });
  }

  // Validate mealType
  const validMealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Brunch'];
  if (!validMealTypes.includes(mealType)) {
    return res.status(400).json({ 
      error: `mealType must be one of: ${validMealTypes.join(', ')}` 
    });
  }

  try {
    // Determine which meal types to check based on the selected meal type
    // For Brunch, check Breakfast, Lunch, and Brunch
    const mealFilter = mealType === "Brunch"
      ? { in: ["Brunch", "Breakfast", "Lunch"] as any[] }
      : mealType as any;

    // Fetch entrees from UMD_Dining for the specific meal type and dining hall by name
    const existingEntrees = await prisma.uMD_Dining.findMany({
      where: {
        entree: { in: entreeNames },
        meal: mealFilter,
        diningHall: diningHall
      },
      select: {
        id: true,
        entree: true,
        meal: true,
        diningHall: true
      }
    });

    const foundNames = existingEntrees.map(e => e.entree);
    const missingNames = entreeNames.filter((name: string) => !foundNames.includes(name));

    if (missingNames.length > 0) {
      return res.status(200).json({
        valid: false,
        missingNames: missingNames,
        message: `Some entrees are not available for ${mealType} at ${diningHall}`
      });
    }

    return res.status(200).json({
      valid: true,
      message: `All entrees are available for ${mealType} at ${diningHall}`
    });
  } catch (error) {
    console.error('Error verifying entrees:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /get-entrees-by-names - Look up current entree IDs by name for a meal type and dining hall
app.post('/get-entrees-by-names', authenticateJWT, async (req: Request, res: Response) => {
  const { entreeNames, mealType, diningHall } = req.body;

  if (!entreeNames || !Array.isArray(entreeNames) || entreeNames.length === 0) {
    return res.status(400).json({ error: 'entreeNames (non-empty array) is required' });
  }

  if (!mealType || !diningHall) {
    return res.status(400).json({ error: 'mealType and diningHall are required' });
  }

  // Validate mealType
  const validMealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Brunch'];
  if (!validMealTypes.includes(mealType)) {
    return res.status(400).json({ 
      error: `mealType must be one of: ${validMealTypes.join(', ')}` 
    });
  }

  try {
    // Determine which meal types to check based on the selected meal type
    // For Brunch, check Breakfast, Lunch, and Brunch
    const mealFilter = mealType === "Brunch"
      ? { in: ["Brunch", "Breakfast", "Lunch"] as any[] }
      : mealType as any;

    // Fetch entrees from UMD_Dining by name for the specific meal type and dining hall
    const existingEntrees = await prisma.uMD_Dining.findMany({
      where: {
        entree: { in: entreeNames },
        meal: mealFilter,
        diningHall: diningHall
      },
      select: {
        id: true,
        entree: true,
        meal: true,
        diningHall: true
      }
    });

    return res.status(200).json({
      entrees: existingEntrees
    });
  } catch (error) {
    console.error('Error looking up entrees:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /add-meal
app.post('/add-meal', authenticateJWT, async (req: Request, res: Response) => {
  const { mealName, mealDescription, mealType, date, diningHall, entrees, servingSize } = req.body;
  const username = (req as any).user?.username;

  // Validation
  if (!mealName || !mealType || !date || !diningHall || !entrees || !Array.isArray(entrees) || entrees.length === 0) {
    return res.status(400).json({ 
      error: 'mealName, mealType, date, diningHall, and entrees (non-empty array) are required' 
    });
  }

  if (!username) {
    return res.status(401).json({ error: 'Username missing from token' });
  }

  // Validate mealType
  const validMealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Brunch'];
  if (!validMealTypes.includes(mealType)) {
    return res.status(400).json({ 
      error: `mealType must be one of: ${validMealTypes.join(', ')}` 
    });
  }

  // Validate servingSize (default to 1 if not provided)
  const servings = servingSize ? parseInt(servingSize) : 1;
  if (servings < 1) {
    return res.status(400).json({ error: 'servingSize must be at least 1' });
  }

  try {
    // Fetch entree data from UMD_Dining table using IDs
    console.log(entrees) 
    
    // Extract entree IDs and create a map of entreeId -> servingSize
    const entreeIds: number[] = [];
    const entreeServingSizes = new Map<number, number>();
    
    entrees.forEach((e: any) => {
      if (typeof e === 'object' && e.id !== undefined) {
        entreeIds.push(e.id);
        // Use servingSize from request, default to 1 if not provided
        entreeServingSizes.set(e.id, e.servingSize || 1);
      } else if (typeof e === 'number') {
        entreeIds.push(e);
        entreeServingSizes.set(e, 1); // Default to 1 if just ID provided
      }
    });

    const entreeData = await prisma.uMD_Dining.findMany({
      where: {
        id: { in: entreeIds }
      },
      select: {
        id: true,
        entree: true,
        totalCalories: true,
        totalFat: true,
        totalCarbohydrate: true,
        protein: true
      }
    });

    // Validate that all entrees were found
    if (entreeData.length !== entreeIds.length) {
      const foundIds = entreeData.map(e => e.id);
      const missingIds = entreeIds.filter(id => !foundIds.includes(id));
      return res.status(400).json({ 
        error: `Some entrees not found. Missing IDs: ${missingIds.join(', ')}` 
      });
    }

    // Calculate macros using each entree's servingSize
    // Multiply each entree's macros by its servingSize, then sum
    const baseCalories = entreeData.reduce((sum, e) => {
      const servingSize = entreeServingSizes.get(e.id) || 1;
      return sum + (e.totalCalories * servingSize);
    }, 0);
    
    const baseProtein = entreeData.reduce((sum, e) => {
      const servingSize = entreeServingSizes.get(e.id) || 1;
      return sum + (e.protein * servingSize);
    }, 0);
    
    const baseCarbs = entreeData.reduce((sum, e) => {
      const servingSize = entreeServingSizes.get(e.id) || 1;
      return sum + (e.totalCarbohydrate * servingSize);
    }, 0);
    
    const baseFats = entreeData.reduce((sum, e) => {
      const servingSize = entreeServingSizes.get(e.id) || 1;
      return sum + (e.totalFat * servingSize);
    }, 0);

    // Calculate macros for MealStats (multiply by overall meal servingSize)
    const totalCalories = baseCalories * servings;
    const totalProtein = baseProtein * servings;
    const totalCarbs = baseCarbs * servings;
    const totalFats = baseFats * servings;

    // Expand entrees array to include entree names
    // Create a map of entree ID to entree name for quick lookup
    const entreeNameMap = new Map(entreeData.map(e => [e.id, e.entree]));
    
    // Expand entrees array: [{id, servingSize}] -> [{id, entree, servingSize}]
    const entreesWithNames = entrees.map((e: any) => {
      const entreeId = typeof e === 'object' ? e.id : e;
      const servingSize = typeof e === 'object' && e.servingSize !== undefined ? e.servingSize : 1;
      const entreeName = entreeNameMap.get(entreeId) || '';
      return {
        id: entreeId,
        entree: entreeName,
        servingSize: servingSize
      };
    });

    // Parse date string to DateTime
    const mealDate = new Date(date);

    // Create Meal record with base values (for 1 serving)
    const meal = await prisma.meal.create({
      data: {
        username: username, 
        mealName: mealName,
        mealDescription: mealDescription || null,
        meal: mealType as any,
        date: mealDate,
        diningHall: diningHall,
        servingSize: servings,
        entrees: entreesWithNames, // Store entrees with names
        totalCalories: baseCalories,      // Store base (1 serving)
        totalProtein: baseProtein,        // Store base (1 serving)
        totalCarbs: baseCarbs,            // Store base (1 serving)
        totalFats: baseFats                // Store base (1 serving)
      }
    });

    // Update or create MealStats for the date/meal type
    // First, get existing stats for this date and meal type
    const startOfDay = new Date(mealDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(mealDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingStats = await prisma.mealStats.findFirst({
      where: {
        username: username,
        date: {
          gte: startOfDay,
          lt: endOfDay
        },
        meal: mealType as any
      }
    });

    if (existingStats) {
      // Update existing stats by adding the new meal's macros (multiplied by servingSize)
      await prisma.mealStats.update({
        where: { id: existingStats.id },
        data: {
          calories: existingStats.calories + totalCalories,
          protein: existingStats.protein + totalProtein,
          fats: existingStats.fats + totalFats,
          carbs: existingStats.carbs + totalCarbs
        }
      });
    } else {
      // Create new MealStats record (multiplied by servingSize)
      await prisma.mealStats.create({
        data: {
          username: username,
          date: mealDate,
          meal: mealType as any,
          calories: totalCalories,    // Multiplied by servingSize
          protein: totalProtein,      // Multiplied by servingSize
          fats: totalFats,            // Multiplied by servingSize
          carbs: totalCarbs           // Multiplied by servingSize
        }
      });
    }

    return res.status(201).json({ 
      meal: meal,
      message: 'Meal added successfully' 
    });
  } catch (error: any) {
    console.error('Error adding meal:', error);
    
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Meal already exists' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /weekly-macros
// Optional query param: date (ISO string) - defaults to today if not provided
app.get('/weekly-macros', authenticateJWT, async (req: Request, res: Response) => {
  const dateParam = req.query.date as string | undefined;
  const username = (req as any).user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Username missing from token' });
  }

  try {
    // Initialize 4 arrays of length 7 with zeros
    const protein: number[] = new Array(7).fill(0);
    const calories: number[] = new Array(7).fill(0);
    const carbs: number[] = new Array(7).fill(0);
    const fats: number[] = new Array(7).fill(0);

    // Use provided date or default to today
    const referenceDate = dateParam ? new Date(dateParam) : new Date();
    
    // Validate the date
    if (isNaN(referenceDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    // Calculate previous Monday and upcoming Sunday based on reference date
    const currentDay = referenceDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    // Calculate days to subtract to get to Monday (if reference day is Sunday, go back 6 days)
    const daysToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const previousMonday = new Date(referenceDate);
    previousMonday.setDate(referenceDate.getDate() - daysToMonday);
    previousMonday.setHours(0, 0, 0, 0);

    // Calculate days to add to get to Sunday (if reference day is Sunday, add 0 days)
    const daysToSunday = currentDay === 0 ? 0 : 7 - currentDay;
    const upcomingSunday = new Date(referenceDate);
    upcomingSunday.setDate(referenceDate.getDate() + daysToSunday);
    upcomingSunday.setHours(23, 59, 59, 999);

    // Fetch all MealStats entries between Monday and Sunday
    const mealStatsEntries = await prisma.mealStats.findMany({
      where: {
        username: username,
        date: {
          gte: previousMonday,
          lte: upcomingSunday
        }
      },
      select: {
        date: true,
        calories: true,
        protein: true,
        carbs: true,
        fats: true
      }
    });

    // Loop through each entry and populate arrays based on day of week
    mealStatsEntries.forEach((entry) => {
      const entryDate = new Date(entry.date);
      const dayOfWeek = entryDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      
      // Map day of week to array index (Monday = 0, Tuesday = 1, ..., Sunday = 6)
      const arrayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

      // Add macros to the appropriate day (summing if multiple entries for same day)
      protein[arrayIndex] += entry.protein;
      calories[arrayIndex] += entry.calories;
      carbs[arrayIndex] += entry.carbs;
      fats[arrayIndex] += entry.fats;
    });

    return res.status(200).json({
      protein,
      calories,
      carbs,
      fats
    });
  } catch (error: any) {
    console.error('Error fetching weekly macros:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /delete-account - Delete user account and all associated data
app.delete('/delete-account', authenticateJWT, async (req: Request, res: Response) => {
  const username = (req as any).user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Username missing from token' });
  }

  try {
    // Delete all MealStats entries for the user
    await prisma.mealStats.deleteMany({
      where: { username: username }
    });

    // Delete all Meal entries for the user
    await prisma.meal.deleteMany({
      where: { username: username }
    });

    // Delete the User entry
    await prisma.user.delete({
      where: { username: username }
    });

    return res.status(200).json({ message: 'Account and all associated data deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting account:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down server...');
  await prisma.$disconnect();
  process.exit(0);
});


