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

3. Copy the `.env.example` file to create your own `.env` file:
```bash
cp .env.example .env
```

4. Update the `.env` file with your credentials:
```env
# At minimum, you'll need:
DATABASE_URL=postgresql://username:password@hostname:5432/database_name
SESSION_SECRET=your_strong_secret_key_here
OPENAI_API_KEY=sk-your_openai_api_key

# For optional features:
STRIPE_SECRET_KEY=sk_test_your_stripe_key
SENDGRID_API_KEY=SG.your_sendgrid_api_key
```

5. Start the development server:
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

Set the following environment variables in the Railway dashboard. Refer to your `.env.example` file for all available options.

**Required Variables:**
- `DATABASE_URL` (automatically added by Railway)
- `SESSION_SECRET` (add a secure random string)
- `NODE_ENV=production`
- `PORT` (automatically added by Railway)
- `HOST=0.0.0.0` (important for Railway's networking)
- `OPENAI_API_KEY` (required for receipt scanning features)
- `OPENAI_MODEL=gpt-4o` (or your preferred OpenAI model)

**Optional Variables (for additional features):**
- `STRIPE_SECRET_KEY` (payment processing)
- `STRIPE_WEBHOOK_SECRET` (for Stripe webhook verification)
- `STRIPE_PRICE_ID` (for subscription products)
- `SENDGRID_API_KEY` (email notifications)
- `SENDGRID_FROM_EMAIL` (sender email for notifications)
- `APP_URL` (your application's public URL)

**Note:** Railway automatically provides the `DATABASE_URL`, but you can also use individual PostgreSQL connection parameters:
- `PGUSER`
- `PGPASSWORD`
- `PGHOST`
- `PGPORT`
- `PGDATABASE`

The application is designed to use either the full `DATABASE_URL` or these individual parameters.

**Setting up Environment Variables in Railway:**
1. Navigate to your project in the Railway dashboard
2. Go to the "Variables" tab
3. You can use the `.env.example` file in this repository as a reference for which variables to set
4. For sensitive values like API keys, ensure you use Railway's secure variables storage

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

**System Tags Initialization:**

The application includes a special migration (011_ensure_system_tags.sql) that sets up standard food categories as system tags:
- This migration is designed to be idempotent (can be run multiple times safely)
- It handles PostgreSQL's automatic column name conversion (is_system → issystem)
- System tags include categories like Vegetables, Fruits, Dairy, Meat, etc.
- These tags are automatically assigned to food items during receipt scanning
- The migration will run during the deployment process

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
- `stores` - Stores where items were purchased, extracted from receipts
- `receipts` - Scanned and processed shopping receipts
- `tags` - Categorization tags for food items (system and user-defined)
- `food_item_tags` - Junction table for many-to-many relationship between food items and tags
- `products` - Normalized product database for consistent item tracking
- `product_aliases` - Alternative names for products to improve recognition

### Features
- Soft delete functionality using `deletedAt` timestamp fields
- Currency selection for price display throughout the application
- Decimal quantity support for precise food inventory tracking
- Receipt scanning and OCR processing via OpenAI
- WebSocket-based real-time notifications
- System tags for automatic food categorization
- Receipt text extraction in multiple languages
- Store-specific parsers for different receipt formats
- Intelligent item normalization for consistent tracking
- Automatic expiry date suggestions based on food type

The schema is automatically managed through Drizzle ORM and database migrations.

## Support

For any issues:
1. Check the Railway documentation at [docs.railway.app](https://docs.railway.app)
2. Submit an issue in the GitHub repository
3. Contact Railway support for deployment-specific questions