-- Add memo fields to friendships table
ALTER TABLE "friendships" 
ADD COLUMN IF NOT EXISTS "user1_memo" TEXT,
ADD COLUMN IF NOT EXISTS "user2_memo" TEXT;