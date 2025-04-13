import { z } from "zod";

export const settingsSchema = z.object({
  soundEnabled: z.boolean().default(true),
  browserNotificationsEnabled: z.boolean().default(true),
  workDuration: z.number().default(25),
  breakDuration: z.number().default(5),
  iterations: z.number().default(4),
  darkMode: z.boolean().default(true),
  numberOfBeeps: z.number().min(1).max(5).default(3)
});

export type Settings = z.infer<typeof settingsSchema>; 