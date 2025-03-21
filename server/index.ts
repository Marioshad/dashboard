import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { pool, testConnection } from "./db";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Set trust proxy for Railway's proxy
app.set('trust proxy', 1);

// Log environment and port at startup
log(`Starting server in ${process.env.NODE_ENV || 'development'} mode`);

// Middleware to log API requests
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api") || path === '/ping') {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    log("Testing database connection...");
    await testConnection();

    log("Setting up routes...");
    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`Error: ${message}`);
      if (err.stack) {
        log(`Stack trace: ${err.stack}`);
      }
      res.status(status).json({ message });
    });

    if (app.get("env") === "development") {
      log("Starting in development mode...");
      await setupVite(app, server);
    } else {
      log("Starting in production mode...");
      try {
        serveStatic(app);
      } catch (error) {
        log("Error setting up static file serving:", error);
        throw error;
      }
    }

    // Use PORT from environment variable (required for Railway) or fallback to 5000
    const port = process.env.PORT || 5000;
    log(`Attempting to start server on port ${port}...`);

    server.listen({
      port,
      host: "0.0.0.0",
    }, () => {
      log(`Server is running on port ${port}`);
    });
  } catch (error) {
    log("Startup error:", error);
    process.exit(1);
  }
})();