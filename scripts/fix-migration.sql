-- First, check if the migration is marked as failed
-- If it exists and failed, we need to fix it manually

-- 1. First, remove the failed migration record
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '20250110000000_add_friend_system';

-- 2. Drop tables if they were partially created
DROP TABLE IF EXISTS "friendships" CASCADE;
DROP TABLE IF EXISTS "friend_requests" CASCADE;

-- 3. Drop the index if it was created
DROP INDEX IF EXISTS "users_nickname_key";
DROP INDEX IF EXISTS "users_nickname_idx";

-- 4. Now the migration can be reapplied automatically by Prisma