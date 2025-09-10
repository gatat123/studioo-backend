-- Add memo fields to friendships table
ALTER TABLE "friendships" ADD COLUMN "user1_memo" TEXT;
ALTER TABLE "friendships" ADD COLUMN "user2_memo" TEXT;