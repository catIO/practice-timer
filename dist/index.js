// server/index.ts
import express3 from "express";

// server/routes.ts
import express from "express";
import { createServer } from "http";

// server/storage.ts
var MemStorage = class {
  users;
  userSettings;
  userSessions;
  userIdCounter;
  settingsIdCounter;
  sessionIdCounter;
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.userSettings = /* @__PURE__ */ new Map();
    this.userSessions = /* @__PURE__ */ new Map();
    this.userIdCounter = 1;
    this.settingsIdCounter = 1;
    this.sessionIdCounter = 1;
    this.createUser({
      username: "demo",
      password: "password"
    });
  }
  // User methods
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByUsername(username) {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }
  async createUser(insertUser) {
    const id = this.userIdCounter++;
    const user = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  // Settings methods
  async getSettingsByUserId(userId) {
    const userSettings = Array.from(this.userSettings.values()).find(
      (settings2) => settings2.userId === userId
    );
    return userSettings;
  }
  async createSettings(insertSettings) {
    const id = this.settingsIdCounter++;
    const settings2 = {
      ...insertSettings,
      id,
      soundEnabled: insertSettings.soundEnabled ?? true,
      vibrationEnabled: insertSettings.vibrationEnabled ?? true,
      workDuration: insertSettings.workDuration ?? 25,
      breakDuration: insertSettings.breakDuration ?? 5,
      iterations: insertSettings.iterations ?? 4
    };
    this.userSettings.set(id, settings2);
    return settings2;
  }
  async updateSettings(userId, updatedSettings) {
    const existingSettings = await this.getSettingsByUserId(userId);
    if (!existingSettings) {
      throw new Error("Settings not found");
    }
    const settings2 = {
      ...existingSettings,
      ...updatedSettings
    };
    this.userSettings.set(existingSettings.id, settings2);
    return settings2;
  }
  // Session methods
  async getSessionsByUserId(userId) {
    return this.userSessions.get(userId) || [];
  }
  async createSession(insertSession) {
    const id = this.sessionIdCounter++;
    const userId = insertSession.userId ?? 1;
    const session = {
      ...insertSession,
      id,
      userId
    };
    const userSessions = this.userSessions.get(userId) || [];
    userSessions.push(session);
    this.userSessions.set(userId, userSessions);
    return session;
  }
};
var storage = new MemStorage();

// shared/schema.ts
import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull()
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true
});
var settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  soundEnabled: boolean("sound_enabled").notNull().default(true),
  vibrationEnabled: boolean("vibration_enabled").notNull().default(true),
  workDuration: integer("work_duration").notNull().default(25),
  breakDuration: integer("break_duration").notNull().default(5),
  iterations: integer("iterations").notNull().default(4)
});
var insertSettingsSchema = createInsertSchema(settings).pick({
  userId: true,
  soundEnabled: true,
  vibrationEnabled: true,
  workDuration: true,
  breakDuration: true,
  iterations: true
});
var sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  type: text("type").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  duration: integer("duration").notNull()
});
var insertSessionSchema = createInsertSchema(sessions).pick({
  userId: true,
  type: true,
  startTime: true,
  endTime: true,
  duration: true
});

// server/routes.ts
import { z } from "zod";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
async function registerRoutes(app2) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.locals.userId = 1;
    next();
  });
  router.get("/settings", async (req, res) => {
    try {
      const userId = res.locals.userId;
      let userSettings = await storage.getSettingsByUserId(userId);
      if (!userSettings) {
        userSettings = await storage.createSettings({
          userId,
          soundEnabled: true,
          vibrationEnabled: true,
          workDuration: 25,
          breakDuration: 5,
          iterations: 4
        });
      }
      res.json(userSettings);
    } catch (error) {
      res.status(500).json({ message: "Failed to get settings" });
    }
  });
  router.post("/settings", async (req, res) => {
    try {
      const userId = res.locals.userId;
      const settingsData = insertSettingsSchema.omit({ userId: true }).parse({ ...req.body, userId });
      const existingSettings = await storage.getSettingsByUserId(userId);
      let updatedSettings;
      if (existingSettings) {
        updatedSettings = await storage.updateSettings(userId, settingsData);
      } else {
        updatedSettings = await storage.createSettings(settingsData);
      }
      res.json(updatedSettings);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(500).json({ message: "Failed to update settings" });
      }
    }
  });
  router.get("/sessions", async (req, res) => {
    try {
      const userId = res.locals.userId;
      const sessions2 = await storage.getSessionsByUserId(userId);
      res.json(sessions2);
    } catch (error) {
      res.status(500).json({ message: "Failed to get sessions" });
    }
  });
  router.post("/sessions", async (req, res) => {
    try {
      const userId = res.locals.userId;
      const sessionData = insertSessionSchema.omit({ userId: true }).extend({
        type: z.enum(["work", "break"]),
        startTime: z.string().transform((str) => new Date(str)),
        endTime: z.string().transform((str) => new Date(str))
      }).parse({ ...req.body, userId });
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
  app2.use("/api", router);
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express2 from "express";
import fs from "fs";
import path2, { dirname as dirname2 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared")
    }
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = dirname2(__filename2);
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        __dirname2,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(__dirname2, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express2.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express3();
app.use(express3.json());
app.use(express3.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = process.env.PORT || 5e3;
  const host = process.env.HOST || "localhost";
  server.listen({
    port,
    host
    // Use variable
  }, () => {
    log(`Serving on http://${host}:${port}`);
  });
})();
