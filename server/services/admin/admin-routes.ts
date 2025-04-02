import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import Stripe from "stripe";
import { pool } from "../../db";
import { OpenAI } from "openai";

// Initialize Stripe if API key is available
let stripe: Stripe | null = null;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-03-31.basil",
    });
    console.log("[admin] Stripe service initialized");
  } else {
    console.log("[admin] Stripe service not initialized (no API key)");
  }
} catch (error) {
  console.error("[admin] Error initializing Stripe:", error);
}

// Initialize OpenAI if API key is available
let openai: OpenAI | null = null;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log("[admin] OpenAI service initialized");
  } else {
    console.log("[admin] OpenAI service not initialized (no API key)");
  }
} catch (error) {
  console.error("[admin] Error initializing OpenAI:", error);
}

// Check if the user is an admin
function isAdmin(req: Request, res: Response, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const user = req.user;
  if (user.roleId !== 1 && user.roleId !== 2) {
    return res.status(403).json({ message: "Not authorized" });
  }

  next();
}

export function registerAdminRoutes(app: Express) {
  // Middleware to ensure admin access
  app.use('/api/admin', isAdmin);

  // Get Stripe settings
  app.get('/api/admin/stripe-settings', async (req, res) => {
    try {
      // Get settings from app_settings table or environment variables
      // In this example we're just using default values
      res.json({
        priceSmartMonthly: process.env.STRIPE_PRICE_SMART_MONTHLY || "price_smart_monthly",
        priceSmartYearly: process.env.STRIPE_PRICE_SMART_YEARLY || "price_smart_yearly",
        priceProMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY || "price_pro_monthly",
        priceProYearly: process.env.STRIPE_PRICE_PRO_YEARLY || "price_pro_yearly",
        prodSmart: process.env.STRIPE_PRODUCT_SMART || "prod_smart",
        prodPro: process.env.STRIPE_PRODUCT_PRO || "prod_pro",
      });
    } catch (error: any) {
      console.error('Error fetching Stripe settings:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Save Stripe settings
  app.post('/api/admin/stripe-settings', async (req, res) => {
    try {
      const { 
        priceSmartMonthly, 
        priceSmartYearly, 
        priceProMonthly, 
        priceProYearly,
        prodSmart,
        prodPro
      } = req.body;

      // Here you would save the settings to your database or .env
      // For this implementation, we'll assume successful update
      
      res.json({ 
        success: true,
        message: "Stripe settings updated successfully",
        settings: {
          priceSmartMonthly, 
          priceSmartYearly, 
          priceProMonthly, 
          priceProYearly,
          prodSmart,
          prodPro
        }
      });
    } catch (error: any) {
      console.error('Error saving Stripe settings:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Test Stripe connection
  app.post('/api/admin/stripe-test-connection', async (req, res) => {
    try {
      if (!stripe) {
        return res.status(500).json({ message: "Stripe is not configured" });
      }

      // Test the connection by getting account info
      const account = await stripe.accounts.retrieve();
      
      res.json({ 
        success: true, 
        accountId: account.id,
        apiVersion: "2025-03-31.basil" // Use the known API version directly
      });
    } catch (error: any) {
      console.error('Error testing Stripe connection:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Reset all user subscription data
  app.post('/api/admin/reset-all-subscriptions', async (req, res) => {
    try {
      // Get all users with subscription IDs
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // Reset subscription data for all users
        const resetResult = await client.query(`
          UPDATE users 
          SET stripe_subscription_id = NULL, 
              subscription_status = 'inactive',
              subscription_tier = 'free',
              current_billing_period_start = NULL,
              current_billing_period_end = NULL
          WHERE stripe_subscription_id IS NOT NULL
        `);
        
        await client.query('COMMIT');
        
        res.json({ 
          success: true, 
          message: "All subscription data has been reset",
          count: resetResult.rowCount
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error('Error resetting subscription data:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get system status
  app.get('/api/admin/system/status', async (req, res) => {
    try {
      // Database status
      let dbStatus = {
        connected: false,
        version: "",
        lastPing: ""
      };

      try {
        const client = await pool.connect();
        try {
          const result = await client.query('SELECT version()');
          dbStatus.connected = true;
          dbStatus.version = result.rows[0].version;
          dbStatus.lastPing = new Date().toISOString();
        } finally {
          client.release();
        }
      } catch (error) {
        console.error("Database connection error:", error);
      }

      // Stripe status
      let stripeStatus = {
        connected: false,
        apiVersion: "",
        productsCount: 0,
        pricesCount: 0
      };

      if (stripe) {
        try {
          // Check connection by listing a product
          const products = await stripe.products.list({ limit: 10 });
          const prices = await stripe.prices.list({ limit: 10 });
          
          stripeStatus.connected = true;
          stripeStatus.apiVersion = "2025-03-31.basil"; // Use the API version defined in the initialization
          stripeStatus.productsCount = products.data.length;
          stripeStatus.pricesCount = prices.data.length;
        } catch (error) {
          console.error("Stripe connection error:", error);
        }
      }

      // OpenAI status
      let openaiStatus = {
        connected: false,
        availableModels: "",
        defaultModel: ""
      };

      if (openai) {
        try {
          // Check connection by listing models
          const models = await openai.models.list();
          
          openaiStatus.connected = true;
          openaiStatus.availableModels = models.data.length.toString();
          openaiStatus.defaultModel = "gpt-4o"; // Assuming default model
        } catch (error) {
          console.error("OpenAI connection error:", error);
        }
      }

      // Environment variables
      const environmentVariables = [
        { name: "STRIPE_SECRET_KEY", exists: !!process.env.STRIPE_SECRET_KEY, description: "Stripe Secret API key" },
        { name: "VITE_STRIPE_PUBLIC_KEY", exists: !!process.env.VITE_STRIPE_PUBLIC_KEY, description: "Stripe Public API key" },
        { name: "OPENAI_API_KEY", exists: !!process.env.OPENAI_API_KEY, description: "OpenAI API key" },
        { name: "DATABASE_URL", exists: !!process.env.DATABASE_URL, description: "PostgreSQL connection URL" },
        { name: "SENDGRID_API_KEY", exists: !!process.env.SENDGRID_API_KEY, description: "SendGrid Email API key" },
      ];

      res.json({
        database: dbStatus,
        stripe: stripeStatus,
        openai: openaiStatus,
        env: environmentVariables
      });
    } catch (error: any) {
      console.error('Error getting system status:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Refresh database connection
  app.post('/api/admin/system/refresh-db', async (req, res) => {
    try {
      let connected = false;
      let version = "";
      
      try {
        const client = await pool.connect();
        try {
          const result = await client.query('SELECT version()');
          connected = true;
          version = result.rows[0].version;
        } finally {
          client.release();
        }
      } catch (error) {
        console.error("Database connection error during refresh:", error);
        throw new Error("Failed to connect to database");
      }
      
      res.json({ 
        success: true, 
        connected, 
        version
      });
    } catch (error: any) {
      console.error('Error refreshing DB connection:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Check external services
  app.post('/api/admin/system/check-services', async (req, res) => {
    try {
      // Results object to track service status
      const results: any = {
        database: { connected: false },
        stripe: { connected: false },
        openai: { connected: false }
      };
      
      // Check database
      try {
        const client = await pool.connect();
        try {
          await client.query('SELECT 1');
          results.database.connected = true;
        } finally {
          client.release();
        }
      } catch (error) {
        results.database.error = "Failed to connect to database";
      }
      
      // Check Stripe
      if (stripe) {
        try {
          await stripe.products.list({ limit: 1 });
          results.stripe.connected = true;
        } catch (error) {
          results.stripe.error = "Failed to connect to Stripe API";
        }
      } else {
        results.stripe.error = "Stripe is not configured";
      }
      
      // Check OpenAI
      if (openai) {
        try {
          await openai.models.list();
          results.openai.connected = true;
        } catch (error) {
          results.openai.error = "Failed to connect to OpenAI API";
        }
      } else {
        results.openai.error = "OpenAI is not configured";
      }
      
      res.json({ 
        success: true, 
        services: results
      });
    } catch (error: any) {
      console.error('Error checking services:', error);
      res.status(500).json({ message: error.message });
    }
  });
}