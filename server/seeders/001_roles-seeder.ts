// server/seeders/000_roles-permissions-superadmin-seeder.ts

import { db } from '../db';
import { roles, permissions, rolePermissions, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';
import { storage } from '../storage';
import { appLogger as logger } from '../services/logger';

const scryptAsync = promisify(scrypt);

/**
 * Hash password using scrypt
 */
async function hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString('hex')}.${salt}`;
}

/**
 * Seeds roles, permissions, role-permission associations, and Superadmin user.
 */
export async function seedRolesPermissionsAndSuperadminUser({ username, password, email }: { username: string; password: string; email: string; }) {
    logger.info('🌱 Starting full roles, permissions, and superadmin user seeding...');

    const defaultRoles = [
        { name: 'superadmin', description: 'Full access to all features' },
        { name: 'admin', description: 'Can manage users and settings' },
        { name: 'user', description: 'Standard user role with limited permissions' },
        { name: 'Smart Pantry User', description: 'Smart Pantry tier with enhanced features' },
        { name: 'Family Pro User', description: 'Family Pantry Pro tier with all features' },
        { name: 'unverified_user', description: 'Newly registered user with limited access until email is verified' },
    ];

    const defaultPermissions = [
        { name: 'basic_access', description: 'Basic access to application features' },
        { name: 'food_tracking', description: 'Access to food tracking features' },
        { name: 'smart_pantry_features', description: 'Access Smart Pantry tier features' },
        { name: 'family_pantry_pro_features', description: 'Access Family Pantry Pro tier features' },
        { name: 'share_pantry', description: 'Ability to share pantry with other users' },
        { name: 'unlimited_items', description: 'No limit on number of tracked food items' },
        { name: 'unlimited_receipt_scans', description: 'No limit on receipt scans per month' },
        { name: 'manage_account', description: 'Manage account and profile settings' },
        { name: 'create_content', description: 'Create new items, locations, stores, and upload receipts' },
    ];

    for (const role of defaultRoles) {
        const exists = await db.select().from(roles).where(eq(roles.name, role.name));
        if (exists.length === 0) {
            await db.insert(roles).values(role);
            console.log(`✅ Seeded role: ${role.name}`);
        }
    }

    for (const perm of defaultPermissions) {
        const exists = await db.select().from(permissions).where(eq(permissions.name, perm.name));
        if (exists.length === 0) {
            await db.insert(permissions).values(perm);
            console.log(`✅ Seeded permission: ${perm.name}`);
        }
    }

    const allRoles = await db.select().from(roles);
    const allPerms = await db.select().from(permissions);

    const roleMap = Object.fromEntries(allRoles.map(r => [r.name, r.id]));
    const permMap = Object.fromEntries(allPerms.map(p => [p.name, p.id]));

    const rolePerms: Record<string, string[]> = {
        'Smart Pantry User': ['basic_access', 'food_tracking', 'smart_pantry_features', 'unlimited_items'],
        'Family Pro User': [
            'basic_access',
            'food_tracking',
            'smart_pantry_features',
            'family_pantry_pro_features',
            'share_pantry',
            'unlimited_items',
            'unlimited_receipt_scans',
        ],
        'unverified_user': ['manage_account'],
        'user': ['create_content']
    };

    for (const [roleName, permNames] of Object.entries(rolePerms)) {
        const roleId = roleMap[roleName];
        if (!roleId) continue;
        for (const permName of permNames) {
            const permissionId = permMap[permName];
            if (!permissionId) continue;
            await db.insert(rolePermissions).values({ roleId, permissionId }).onConflictDoNothing();
        }
        console.log(`✅ Assigned permissions to role: ${roleName}`);
    }

    // Superadmin and Admin special permissions
    const superadminId = roleMap['superadmin'];
    const adminId = roleMap['admin'];

    if (superadminId) {
        for (const permId of allPerms.map(p => p.id)) {
            await db.insert(rolePermissions).values({ roleId: superadminId, permissionId: permId }).onConflictDoNothing();
        }
        console.log('✅ Assigned all permissions to superadmin');
    }

    if (adminId) {
        const restricted = ['manage_roles', 'manage_permissions'];
        const adminPermIds = allPerms.filter(p => !restricted.includes(p.name)).map(p => p.id);
        for (const permId of adminPermIds) {
            await db.insert(rolePermissions).values({ roleId: adminId, permissionId: permId }).onConflictDoNothing();
        }
        console.log('✅ Assigned filtered permissions to admin');
    }

    // Superadmin user creation
    const superadminRole = allRoles.find(r => r.name === 'superadmin');
    if (!superadminRole) throw new Error('Superadmin role not found');

    const existingUser = await db.select().from(users).where(eq(users.username, username)).limit(1);

    if (existingUser.length > 0) {
        await db.update(users).set({
            roleId: superadminRole.id,
            emailVerified: true,
            updatedAt: sql`CURRENT_TIMESTAMP`
        }).where(eq(users.username, username));
        logger.info(`ℹ️ Updated existing user '${username}' with superadmin role`);
    } else {
        const hashed = await hashPassword(password);
        await db.insert(users).values({
            username,
            password: hashed,
            email,
            roleId: superadminRole.id,
            fullName: 'System Administrator',
            currency: 'USD',
            emailVerified: true,
            subscriptionTier: 'pro',
            subscriptionStatus: 'active',
            receiptScansLimit: 999999,
            maxItems: 999999,
            maxSharedUsers: 999999,
            createdAt: sql`CURRENT_TIMESTAMP`,
            updatedAt: sql`CURRENT_TIMESTAMP`
        });
        logger.info(`✅ Created superadmin user '${username}'`);
    }

    return { success: true };
}
