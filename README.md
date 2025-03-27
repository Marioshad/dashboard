# Authentication Dashboard Application

A React.js and Node.js application with user authentication and a basic dashboard. Built with Express.js backend and PostgreSQL database.

## Features

- User authentication (Login/Register)
- Protected dashboard route
- User profile display
- Session management
- PostgreSQL database integration

## Local Development

### Prerequisites

- Node.js 20.x or higher
- npm 8.x or higher
- PostgreSQL database

### Getting Started

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with:
```env
DATABASE_URL=postgresql://your_database_url
SESSION_SECRET=your_session_secret
```

4. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Deploying to Railway

### 1. Prepare Your Application

Make sure your code is in a Git repository and pushed to GitHub.

### 2. Railway Setup

1. Create a Railway account at [railway.app](https://railway.app)
2. Create a new project from GitHub
3. Select your repository
4. Add a PostgreSQL database:
   - Click "New" → "Database" → "PostgreSQL"
   - Railway will automatically add the database URL to your environment

### 3. Environment Variables

Set the following environment variables in Railway dashboard:
- `DATABASE_URL` (automatically added by Railway)
- `SESSION_SECRET` (add a secure random string)
- `NODE_ENV=production`
- `PORT` (automatically added by Railway)
- `OPENAI_API_KEY` (if using receipt scanning features)
- `STRIPE_SECRET_KEY` (optional, for payment processing)
- `SENDGRID_API_KEY` (optional, for email notifications)
- `SENDGRID_FROM_EMAIL` (optional, sender email for notifications)

### 4. Deployment Settings

Configure your deployment settings in Railway:
- Build Command: `npm install && npm run build && ./railway-build.sh`
- Start Command: `npm start`

**Important:** The `railway-build.sh` script is crucial as it ensures migration files are copied to the correct location in the production build.

### 5. Database Migrations

The application automatically runs migrations on startup:

1. All migration files in `server/migrations` are processed in order based on their numeric prefix (001_, 002_, etc.)
2. Migrations use transactions, so they either completely succeed or completely fail
3. Changes to the database schema should be done through new migration files
4. If migrations fail, the application will log detailed errors but will still attempt to start with the existing schema

### 6. Important Notes

- The application uses secure session cookies in production
- WebSocket connections for real-time notifications are routed through `/api/ws`
- PostgreSQL is configured to use SSL for remote connections
- Receipt processing uses OpenAI's Vision API for OCR scanning
- Stripe integration is optional - if the API key is not provided, payment features will be disabled but the app will continue to function

## Database Schema

The application uses a comprehensive schema with several tables:

### Core Tables
- `users` - User accounts and profile information
- `roles` - User role definitions
- `permissions` - Available permissions in the system
- `role_permissions` - Many-to-many relationship between roles and permissions

### Application-specific Tables
- `app_settings` - User-specific application settings including currency preferences
- `notifications` - User notifications for real-time updates
- `locations` - Food storage locations (pantry, refrigerator, freezer, etc.)
- `food_items` - Inventory of food items with expiry tracking

### Features
- Soft delete functionality using `deletedAt` timestamp fields
- Currency selection for price display throughout the application
- Decimal quantity support for precise food inventory tracking
- Receipt scanning and OCR processing via OpenAI
- WebSocket-based real-time notifications

The schema is automatically managed through Drizzle ORM and database migrations.

## Support

For any issues:
1. Check the Railway documentation at [docs.railway.app](https://docs.railway.app)
2. Submit an issue in the GitHub repository
3. Contact Railway support for deployment-specific questions