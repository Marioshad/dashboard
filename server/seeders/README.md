# Database Seeders

This directory contains seeders for initializing the database with essential data.

## Available Seeders

1. **Admin Roles Seeder** (`admin-001_roles-seeder.ts`):
   - Creates the 'Superadmin' and 'Admin' roles
   - Assigns appropriate permissions to each role
   - Superadmin gets all permissions
   - Admin gets all permissions except 'manage_roles' and 'manage_permissions'

2. **Superadmin User Seeder** (`superadmin-user-seeder.ts`):
   - Creates a Superadmin user or updates an existing user with the Superadmin role
   - Sets unlimited usage limits for the Superadmin
   - Sets the user as email verified
   - Assigns the 'family_pro_tier' subscription tier

## How to Run Seeders

### Method 1: Using the CLI Tool

Run the following command:

```bash
npx tsx server/run-seeders.ts --superadmin-username admin --superadmin-password securepassword --superadmin-email admin@example.com
```

### Method 2: Programmatically

Import and use the seeder functions directly in your code:

```typescript
import { runSeeders } from './seeders';

async function seedDatabase() {
  await runSeeders({
    superadmin: {
      username: 'admin',
      password: 'securepassword',
      email: 'admin@example.com'
    }
  });
}
```

## Adding New Seeders

When adding a new seeder:

1. Create a new file in the `seeders` directory
2. Export a main function to perform the seeding operation
3. Add the seeder to the `runSeeders` function in `index.ts`
4. Make sure to respect dependencies between seeders (run them in the correct order)
5. Add appropriate logging using the logger
6. Handle errors properly and return a consistent result object

## Seeder Result Object

Seeders should return a consistent result object:

```typescript
{
  success: boolean;
  error?: any;  // Only if success is false
  // Additional data specific to the seeder
}
```

## Error Handling

All seeders should:
- Handle errors gracefully
- Log errors using the logger
- Return a failure result instead of throwing exceptions