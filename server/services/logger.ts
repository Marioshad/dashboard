import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Define log directory
const LOG_DIR = path.join(process.cwd(), 'logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, service }) => {
    const serviceTag = service ? `[${service}] ` : '';
    return `${timestamp} ${level.toUpperCase()}: ${serviceTag}${message}${stack ? '\n' + stack : ''}`;
  })
);

// Create loggers for different components
const appLogger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'app' },
  transports: [
    // Write all logs to console
    new winston.transports.Console(),
    // Write all logs to appropriate files
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'combined.log') 
    }),
  ],
});

// Create a specialized logger for email-related operations
const emailLogger = winston.createLogger({
  level: 'debug',
  format: logFormat,
  defaultMeta: { service: 'email' },
  transports: [
    // Write all logs to console
    new winston.transports.Console(),
    // Write all logs to appropriate files
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'email.log') 
    }),
  ],
});

// Create a specialized logger for authentication operations
const authLogger = winston.createLogger({
  level: 'debug',
  format: logFormat,
  defaultMeta: { service: 'auth' },
  transports: [
    // Write all logs to console
    new winston.transports.Console(),
    // Write all logs to appropriate files
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'auth.log') 
    }),
  ],
});

// Create a specialized logger for database operations
const dbLogger = winston.createLogger({
  level: 'debug',
  format: logFormat,
  defaultMeta: { service: 'database' },
  transports: [
    // Write all logs to console
    new winston.transports.Console(),
    // Write all logs to appropriate files
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'database.log') 
    }),
  ],
});

// Create a specialized logger for Stripe operations
const stripeLogger = winston.createLogger({
  level: 'debug',
  format: logFormat,
  defaultMeta: { service: 'stripe' },
  transports: [
    // Write all logs to console
    new winston.transports.Console(),
    // Write all logs to appropriate files
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'stripe.log') 
    }),
  ],
});

// Create a specialized logger for WebSocket operations
const wsLogger = winston.createLogger({
  level: 'debug',
  format: logFormat,
  defaultMeta: { service: 'websocket' },
  transports: [
    // Write all logs to console
    new winston.transports.Console(),
    // Write all logs to appropriate files
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'websocket.log') 
    }),
  ],
});

// Creating a specialized logger for OpenAI operations
const openaiLogger = winston.createLogger({
  level: 'debug',
  format: logFormat,
  defaultMeta: { service: 'openai' },
  transports: [
    // Write all logs to console
    new winston.transports.Console(),
    // Write all logs to appropriate files
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'openai.log') 
    }),
  ],
});

// Creating a specialized logger for Notification operations
const notificationLogger = winston.createLogger({
  level: 'debug',
  format: logFormat,
  defaultMeta: { service: 'notification' },
  transports: [
    // Write all logs to console
    new winston.transports.Console(),
    // Write all logs to appropriate files
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'notification.log') 
    }),
  ],
});

// Export the loggers
export {
  appLogger,
  emailLogger,
  authLogger,
  dbLogger,
  stripeLogger,
  wsLogger,
  openaiLogger,
  notificationLogger
};

// Create a express middleware for logging http requests
export const requestLogger = (req: any, res: any, next: any) => {
  const start = new Date().getTime();
  
  res.on('finish', () => {
    const duration = new Date().getTime() - start;
    const message = `${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${duration}ms`;
    
    if (res.statusCode >= 400) {
      appLogger.warn(message);
    } else {
      appLogger.info(message);
    }
  });
  
  next();
};

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  appLogger.error('Uncaught Exception:', error);
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  appLogger.error('Unhandled Rejection:', reason);
});

// Export a stream for Morgan (if needed)
export const stream = {
  write: (message: string) => {
    appLogger.info(message.trim());
  },
};