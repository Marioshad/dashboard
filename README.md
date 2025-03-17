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

Add the following environment variables in Railway dashboard:
- `DATABASE_URL` (automatically added by Railway)
- `SESSION_SECRET` (add a secure random string)
- `NODE_ENV=production`
- `PORT` (automatically added by Railway)

### 4. Deployment Settings

Configure your deployment settings in Railway:
- Build Command: `npm install && npm run build`
- Start Command: `npm start`

### 5. Domain Setup

1. Go to your project settings in Railway
2. Navigate to the "Domains" section
3. Click "Generate Domain" or add your custom domain

## Database Schema

The application uses a simple users table:
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);
```

The schema is automatically managed through the application.

## Support

For any issues:
1. Check the Railway documentation at [docs.railway.app](https://docs.railway.app)
2. Submit an issue in the GitHub repository
3. Contact Railway support for deployment-specific questions