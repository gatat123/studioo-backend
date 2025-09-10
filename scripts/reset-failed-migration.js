// This script resets the failed migration in Railway database
// Run this with: node scripts/reset-failed-migration.js

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function resetFailedMigration() {
  try {
    console.log('Resetting failed migration...');
    
    // Delete the failed migration record
    await prisma.$executeRaw`
      DELETE FROM "_prisma_migrations" 
      WHERE migration_name = '20250110000000_add_friend_system'
    `;
    
    console.log('Failed migration record deleted.');
    
    // Check if bio column exists
    const bioExists = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'bio'
    `;
    
    if (bioExists.length === 0) {
      console.log('Bio column does not exist, will be created by migration.');
    } else {
      console.log('Bio column already exists.');
    }
    
    // Check if friend tables exist
    const friendRequestsExists = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'friend_requests'
    `;
    
    if (friendRequestsExists.length > 0) {
      console.log('Dropping existing friend_requests table...');
      await prisma.$executeRaw`DROP TABLE IF EXISTS "friend_requests" CASCADE`;
    }
    
    const friendshipsExists = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'friendships'
    `;
    
    if (friendshipsExists.length > 0) {
      console.log('Dropping existing friendships table...');
      await prisma.$executeRaw`DROP TABLE IF EXISTS "friendships" CASCADE`;
    }
    
    console.log('Migration reset complete. Deploy again to apply migration.');
    
  } catch (error) {
    console.error('Error resetting migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetFailedMigration();