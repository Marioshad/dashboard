import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { sendVerificationEmail, verifyEmail, resendVerificationEmail } from "./services/email/verification-service";
import { log } from "./vite";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  // Define session secret and make it available for WebSocket handlers
  const SESSION_SECRET = process.env.SESSION_SECRET || "development_secret";
  app.locals.SESSION_SECRET = SESSION_SECRET;
  
  const sessionSettings: session.SessionOptions = {
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    name: 'connect.sid', // Explicitly set the cookie name for consistent access
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      httpOnly: true,
      path: '/' // Ensure cookie is available for all paths including WebSocket requests
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log(`Attempting to authenticate user: ${username}`);
        
        // Check if username is provided
        if (!username) {
          console.error('Authentication failed: No username provided');
          return done(null, false, { message: "Username is required" });
        }
        
        const user = await storage.getUserByUsername(username);
        console.log(`User lookup result: ${user ? 'Found' : 'Not found'}`);
        
        if (!user) {
          console.log(`Authentication failed: User not found for username: ${username}`);
          return done(null, false, { message: "Invalid username or password" });
        }
        
        // Check if password field exists
        if (!user.password) {
          console.error(`Authentication failed: User ${username} has no password field`);
          return done(null, false, { message: "Invalid user account" });
        }
        
        const passwordValid = await comparePasswords(password, user.password);
        console.log(`Password validation result: ${passwordValid ? 'Valid' : 'Invalid'}`);
        
        if (!passwordValid) {
          console.log(`Authentication failed: Invalid password for username: ${username}`);
          return done(null, false, { message: "Invalid username or password" });
        }
        
        console.log(`User authenticated successfully: ${username}, ID: ${user.id}`);
        return done(null, user);
      } catch (err) {
        console.error('Authentication error:', err);
        return done(err);
      }
    }),
  );

  passport.serializeUser((user: Express.User, done) => {
    // Added null check to prevent "Cannot convert undefined or null to object" error
    if (!user || user.id === undefined) {
      console.error('Serialization error: User or user.id is undefined');
      return done(new Error('Invalid user object'));
    }
    console.log(`Serializing user: ${user.id}`);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      // Ensure we have a valid ID
      if (id === undefined || id === null) {
        console.error('Deserialization error: Invalid user ID');
        return done(null, false); // Return false instead of error to prevent crash
      }
      
      console.log(`Attempting to deserialize user with ID: ${id}`);
      
      try {
        const user = await storage.getUser(id);
        
        if (!user) {
          console.error(`Deserialization error: No user found with ID: ${id}`);
          return done(null, false);
        }
        
        // Ensure maxSharedUsers exists on the user object
        if (!('maxSharedUsers' in user)) {
          (user as any).maxSharedUsers = 1;
        }
        
        console.log(`Deserialized user ${id}: found`);
        done(null, user);
      } catch (getUserErr) {
        console.error(`Error getting user in deserializeUser: ${getUserErr}`);
        // Return false instead of error to prevent crash
        return done(null, false);
      }
    } catch (err) {
      console.error('Deserialization error:', err);
      // Return false instead of error to prevent crash
      done(null, false);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        console.log(`Registration failed: Username ${req.body.username} already exists`);
        return res.status(400).json({ message: "Username already exists" });
      }

      // Get the unverified_user role ID
      const unverifiedRole = await storage.getRoleByName("unverified_user");
      
      // Create user with unverified_user role and email_verified set to false by default
      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
        roleId: unverifiedRole?.id || 6, // Default to ID 6 which is the unverified_user role
        emailVerified: false,
      });

      console.log(`User registered successfully: ${user.username}`);
      
      // Send verification email
      try {
        // Get the base URL from the request
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers['x-forwarded-host'] || req.get('host');
        const baseUrl = `${protocol}://${host}`;
        
        log(`Attempting to send verification email to ${user.email} from ${baseUrl}`, 'auth');
        
        if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL && user.email) {
          try {
            // Use user ID directly instead of trying to pass the full user object
            const emailSent = await sendVerificationEmail(user.id, baseUrl);
            if (emailSent) {
              log(`Verification email sent successfully to ${user.email}`, 'auth');
            } else {
              log(`Failed to send verification email to ${user.email}`, 'auth');
            }
          } catch (e) {
            console.error('Error in sendVerificationEmail:', e);
            log(`Error in sendVerificationEmail: ${e}`, 'auth');
          }
        } else {
          log('Email verification skipped - missing SendGrid configuration or user email', 'auth');
        }
      } catch (emailError) {
        // Don't fail registration if email sending fails
        log(`Error sending verification email: ${emailError}`, 'auth');
      }

      // Login the user with proper type handling
      req.login(user, (loginErr: any) => {
        if (loginErr) {
          console.error('Login error after registration:', loginErr);
          return next(loginErr);
        }
        console.log(`Session created for new user: ${user.username}, ID: ${user.id}`);
        res.status(201).json(user);
      });
    } catch (err) {
      console.error('Registration error:', err);
      next(err);
    }
  });

  app.post("/api/login", (req, res, next) => {
    console.log('Login attempt with body:', req.body ? 
                { username: req.body.username, password: req.body.password ? '[REDACTED]' : undefined } : 
                'No request body');
    
    passport.authenticate("local", (err: any, user: Express.User | false, info: { message?: string } | undefined) => {
      if (err) {
        console.error('Login error:', err);
        return next(err);
      }
      
      if (!user) {
        console.log('Login failed:', info?.message);
        return res.status(401).json({ message: info?.message || "Authentication failed" });
      }
      
      try {
        if (!user.id) {
          console.error('Login error: User has no ID property');
          return res.status(500).json({ message: "User account is invalid" });
        }
        
        req.login(user, (loginErr) => {
          if (loginErr) {
            console.error('Session creation error:', loginErr);
            return next(loginErr);
          }
          
          try {
            console.log(`Session created for user: ${user.username}, ID: ${user.id}`);
            return res.json(user);
          } catch (jsonErr) {
            console.error('Error serializing user to JSON:', jsonErr);
            return res.status(500).json({ message: "Error processing user data" });
          }
        });
      } catch (error) {
        console.error('Unexpected error in login process:', error);
        return res.status(500).json({ message: "Internal server error during login" });
      }
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    const username = req.user?.username;
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
        return next(err);
      }
      console.log(`User logged out successfully: ${username}`);
      // Return JSON response instead of plain text
      res.status(200).json({ success: true, message: 'Logged out successfully' });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      console.log('Unauthorized access attempt to /api/user');
      return res.sendStatus(401);
    }
    console.log(`Current user data retrieved: ${req.user?.username}`);
    res.json(req.user);
  });
}