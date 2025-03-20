import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSessionSchema, insertSettingsSchema } from "@shared/schema";
import { z } from "zod";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  const router = express.Router();

  // Middleware to simulate a logged-in user for demo purposes
  router.use((req, res, next) => {
    // In a real app, this would come from auth middleware
    res.locals.userId = 1;
    next();
  });

  // Get user settings
  router.get("/settings", async (req, res) => {
    try {
      const userId = res.locals.userId;
      let userSettings = await storage.getSettingsByUserId(userId);
      
      if (!userSettings) {
        // Create default settings if none exist
        userSettings = await storage.createSettings({
          userId,
          soundEnabled: true,
          vibrationEnabled: true,
          workDuration: 25,
          breakDuration: 5,
          iterations: 4,
          darkMode: false
        });
      }
      
      // Ensure darkMode is included in the response
      const responseSettings = {
        ...userSettings,
        darkMode: userSettings.darkMode ?? false
      };
      
      console.log('GET /settings - Returning settings:', responseSettings);
      res.json(responseSettings);
    } catch (error) {
      console.error('GET /settings - Error:', error);
      res.status(500).json({ message: "Failed to get settings" });
    }
  });

  // Update user settings
  router.post("/settings", async (req, res) => {
    try {
      console.log('POST /settings - Received request body:', req.body);
      
      // Get user ID from request
      const userId = res.locals.userId;
      console.log('POST /settings - User ID:', userId);
      
      // Remove userId from request body if it exists
      const { userId: _, ...settingsData } = req.body;
      console.log('POST /settings - Settings data after removing userId:', settingsData);
      
      // Ensure darkMode is included in the request
      const requestSettings = {
        ...settingsData,
        darkMode: settingsData.darkMode ?? false
      };
      
      // Validate the request body
      const validatedSettings = insertSettingsSchema.parse({
        ...requestSettings,
        userId: userId,
        darkMode: requestSettings.darkMode ?? false // Ensure darkMode is a boolean
      });
      console.log('POST /settings - Validated settings:', validatedSettings);

      // Check if settings exist for the user
      const existingSettings = await storage.getSettingsByUserId(userId);
      console.log('POST /settings - Existing settings:', existingSettings);

      let updatedSettings;
      if (existingSettings) {
        console.log('POST /settings - Updating existing settings');
        updatedSettings = await storage.updateSettings(userId, {
          ...existingSettings,
          ...validatedSettings,
          id: existingSettings.id,
          userId: userId,
          soundEnabled: validatedSettings.soundEnabled ?? existingSettings.soundEnabled,
          vibrationEnabled: validatedSettings.vibrationEnabled ?? existingSettings.vibrationEnabled,
          workDuration: validatedSettings.workDuration ?? existingSettings.workDuration,
          breakDuration: validatedSettings.breakDuration ?? existingSettings.breakDuration,
          iterations: validatedSettings.iterations ?? existingSettings.iterations,
          darkMode: validatedSettings.darkMode ?? false // Ensure darkMode is a boolean
        });
      } else {
        console.log('POST /settings - Creating new settings');
        updatedSettings = await storage.createSettings({
          ...validatedSettings,
          userId: userId,
          soundEnabled: validatedSettings.soundEnabled ?? true,
          vibrationEnabled: validatedSettings.vibrationEnabled ?? true,
          workDuration: validatedSettings.workDuration ?? 25,
          breakDuration: validatedSettings.breakDuration ?? 5,
          iterations: validatedSettings.iterations ?? 4,
          darkMode: validatedSettings.darkMode ?? false // Ensure darkMode is a boolean
        });
      }

      // Ensure darkMode is included in the response
      const responseSettings = {
        ...updatedSettings,
        darkMode: updatedSettings.darkMode ?? false
      };
      
      console.log('POST /settings - Final settings to be sent:', responseSettings);
      res.json(responseSettings);
    } catch (error) {
      console.error('POST /settings - Error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid settings data' });
      } else {
        res.status(500).json({ error: 'Failed to update settings' });
      }
    }
  });

  // Get user sessions
  router.get("/sessions", async (req, res) => {
    try {
      const userId = res.locals.userId;
      const sessions = await storage.getSessionsByUserId(userId);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to get sessions" });
    }
  });

  // Create a new session
  router.post("/sessions", async (req, res) => {
    try {
      const userId = res.locals.userId;
      
      // Validate session data
      const sessionData = insertSessionSchema
        .omit({ userId: true })
        .extend({
          type: z.enum(["work", "break"]),
          startTime: z.string().transform(str => new Date(str)),
          endTime: z.string().transform(str => new Date(str)),
        })
        .parse({ ...req.body, userId });
      
      const newSession = await storage.createSession(sessionData);
      res.status(201).json(newSession);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: "Failed to create session" });
      }
    }
  });

  // Register API routes with /api prefix
  app.use("/api", router);

  const httpServer = createServer(app);
  return httpServer;
}
