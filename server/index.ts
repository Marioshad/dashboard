import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { testDatabaseConnection, db } from "./db";
import { runMigrations } from "./migration-runner";
import { tags } from "@shared/schema";
import { sql, eq } from "drizzle-orm";
import dotenv from 'dotenv';
import { createServer } from "http";
import { initializeWebSocketServer } from './websockets';
import { storage } from './storage';

// Load environment variables from .env file
dotenv.config();

// Session secret for cookie validation
const SESSION_SECRET = process.env.SESSION_SECRET || 'keyboard cat';

// System tags configuration
const SYSTEM_TAGS = [
  { name: 'Vegetables', color: '#4CAF50' },
  { name: 'Fruits', color: '#FF9800' },
  { name: 'Dairy', color: '#2196F3' },
  { name: 'Meat', color: '#F44336' },
  { name: 'Seafood', color: '#03A9F4' },
  { name: 'Bakery', color: '#FFC107' },
  { name: 'Canned Goods', color: '#607D8B' },
  { name: 'Frozen Foods', color: '#9C27B0' },
  { name: 'Beverages', color: '#795548' },
  { name: 'Snacks', color: '#E91E63' },
  { name: 'Cleaning', color: '#009688' },
  { name: 'Personal Care', color: '#673AB7' },
  { name: 'Organic', color: '#8BC34A' },
  { name: 'Gluten-Free', color: '#CDDC39' }
];

/**
 * Ensures that system tags exist in the database.
 * This function is called on server startup to make sure all required
 * system tags are created, regardless of whether migrations ran successfully.
 */
async function ensureSystemTags() {
  try {
    log("Ensuring system tags exist...");
    
    // First check if the tags table exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'tags'
      );
    `);
    
    if (!tableExists.rows?.[0]?.exists) {
      log("Tags table does not exist, skipping system tags initialization");
      return;
    }
    
    // Check for the existence of issystem (camelCase gets converted to lowercase in PostgreSQL)
    const columnCheckResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tags' 
      AND (column_name = 'is_system' OR column_name = 'issystem')
    `);
    
    if (columnCheckResult.rows.length === 0) {
      log("Neither is_system nor issystem column exists in tags table, skipping system tags initialization");
      return;
    }
    
    // Determine which column name to use (is_system or issystem)
    const systemColumnName = columnCheckResult.rows[0].column_name;
    log(`Using ${systemColumnName} as the system tag column`);
    
    // Get existing system tags - we'll use parameterized queries for safety
    let result;
    if (systemColumnName === 'is_system') {
      result = await db.execute(sql`SELECT id, name FROM tags WHERE is_system = true`);
    } else {
      result = await db.execute(sql`SELECT id, name FROM tags WHERE issystem = true`);
    }
    
    const existingTags = result.rows.map(row => (row as Record<string, string>).name.toLowerCase());
    log(`Found ${existingTags.length} existing system tags`);
    
    // Check for duplicates (multiple system tags with the same name)
    let duplicateCheck;
    if (systemColumnName === 'is_system') {
      duplicateCheck = await db.execute(sql`
        SELECT name, COUNT(*) as count
        FROM tags 
        WHERE is_system = true
        GROUP BY name
        HAVING COUNT(*) > 1
      `);
    } else {
      duplicateCheck = await db.execute(sql`
        SELECT name, COUNT(*) as count
        FROM tags 
        WHERE issystem = true
        GROUP BY name
        HAVING COUNT(*) > 1
      `);
    }
    
    // If duplicates found, remove them
    if (duplicateCheck.rows.length > 0) {
      log(`Found duplicate system tags: ${duplicateCheck.rows.map(r => (r as Record<string, any>).name).join(', ')}`);
      
      for (const row of duplicateCheck.rows) {
        const tagName = (row as Record<string, any>).name;
        
        // Get all IDs of this duplicate tag
        let dupTagsResult;
        if (systemColumnName === 'is_system') {
          dupTagsResult = await db.execute(sql`
            SELECT id FROM tags 
            WHERE name = ${tagName} AND is_system = true
            ORDER BY id
          `);
        } else {
          dupTagsResult = await db.execute(sql`
            SELECT id FROM tags 
            WHERE name = ${tagName} AND issystem = true
            ORDER BY id
          `);
        }
        
        const dupIds = dupTagsResult.rows.map(r => (r as Record<string, any>).id);
        
        // Keep the first one, delete the rest
        const keepId = dupIds[0];
        const idsToDelete = dupIds.slice(1);
        
        log(`Keeping system tag ${tagName} with ID ${keepId}, removing duplicates: ${idsToDelete.join(', ')}`);
        
        for (const idToDelete of idsToDelete) {
          // Update food_item_tags references to point to the kept tag
          await db.execute(sql`
            UPDATE food_item_tags 
            SET tag_id = ${keepId}
            WHERE tag_id = ${idToDelete}
            AND NOT EXISTS (
              SELECT 1 FROM food_item_tags
              WHERE tag_id = ${keepId} AND food_item_id = food_item_tags.food_item_id
            )
          `);
          
          // Delete duplicate tag
          await db.execute(sql`DELETE FROM tags WHERE id = ${idToDelete}`);
        }
      }
    }
    
    // Check for missing system tags and add them
    const tagsToAdd = SYSTEM_TAGS.filter(tag => 
      !existingTags.includes(tag.name.toLowerCase())
    );
    
    if (tagsToAdd.length > 0) {
      log(`Adding ${tagsToAdd.length} missing system tags: ${tagsToAdd.map(t => t.name).join(', ')}`);
      
      for (const tag of tagsToAdd) {
        // Insert using raw SQL to handle column name differences
        if (systemColumnName === 'is_system') {
          await db.execute(sql`
            INSERT INTO tags (name, color, is_system, userid, createdat, updatedat)
            VALUES (${tag.name}, ${tag.color}, TRUE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `);
        } else {
          await db.execute(sql`
            INSERT INTO tags (name, color, issystem, userid, createdat, updatedat)
            VALUES (${tag.name}, ${tag.color}, TRUE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `);
        }
      }
    } else {
      log("All system tags are already present");
    }
  } catch (error) {
    log(`Error ensuring system tags: ${error}`);
    // Don't throw, allow the server to continue starting
  }
}

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
    log("Starting application initialization...");

    // Log OpenAI configuration
    log(`OpenAI API Key configured: ${Boolean(process.env.OPENAI_API_KEY)}`);
    log(`OpenAI Model: ${process.env.OPENAI_MODEL || 'gpt-4o (default)'}`);
    
    log("Testing database connection...");
    const dbConnectionStatus = await testDatabaseConnection();
    if (!dbConnectionStatus) {
      log("Database connection test failed - check logs above for detailed error information");
      // Add variables check to help debugging
      log(`DATABASE_URL available: ${Boolean(process.env.DATABASE_URL)}`);
      log(`DATABASE_URL length: ${process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0}`);
      log(`PGHOST available: ${Boolean(process.env.PGHOST)}`);
      log(`PGUSER available: ${Boolean(process.env.PGUSER)}`);
      log(`PGDATABASE available: ${Boolean(process.env.PGDATABASE)}`);
      log(`PGPORT available: ${Boolean(process.env.PGPORT)}`);
      throw new Error("Failed to connect to the database - check server logs for details");
    }

    // Run migrations automatically
    log("Running database migrations...");
    const migrationsStatus = await runMigrations();
    if (migrationsStatus) {
      log("Database migrations completed successfully");
    } else {
      log("Warning: Database migrations failed, continuing startup with existing schema");
      // We continue anyway because migrations might fail if they were already applied
      // or if there are permission issues, but the app might still function with the existing schema
    }
    
    // Ensure system tags are created
    await ensureSystemTags();

    // Setting up routes (does not initialize http server)
    log("Setting up routes...");
    await registerRoutes(app);
    
    // Create HTTP server using createServer within routes.ts
    log("Creating HTTP server...");
    const httpServer = createServer(app);
    
    // Initialize WebSocket server with modular implementation
    log("Initializing WebSocket server with modular implementation...");
    initializeWebSocketServer(httpServer, app, storage, SESSION_SECRET);
    log("WebSocket server initialized with enhanced stability options");
    log("Routes registered successfully");

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
      await setupVite(app, httpServer);
    } else {
      log("Starting in production mode...");
      try {
        serveStatic(app);
      } catch (error) {
        log("Error setting up static file serving: " + String(error));
        throw error;
      }
    }

    const port = process.env.PORT || 5000;
    log(`Attempting to start server on port ${port}...`);
    log(`Using host: 0.0.0.0`);

    httpServer.listen({
      port,
      host: "0.0.0.0",
    }, () => {
      log(`Server is running on port ${port}`);
      log("Server initialization completed successfully");
    });
  } catch (error) {
    log("Startup error: " + String(error));
    process.exit(1);
  }
})();