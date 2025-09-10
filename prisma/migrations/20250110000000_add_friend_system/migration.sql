-- AlterTable
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'bio'
  ) THEN
    ALTER TABLE "users" ADD COLUMN "bio" TEXT;
  END IF;
END $$;

-- CreateIndex
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'users_nickname_key'
  ) THEN
    CREATE UNIQUE INDEX "users_nickname_key" ON "users"("nickname");
  END IF;
END $$;

-- CreateIndex
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'users_nickname_idx'
  ) THEN
    CREATE INDEX "users_nickname_idx" ON "users"("nickname");
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "friend_requests" (
    "id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "friend_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "friendships" (
    "id" TEXT NOT NULL,
    "user1_id" TEXT NOT NULL,
    "user2_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "friend_requests_sender_id_receiver_id_key" ON "friend_requests"("sender_id", "receiver_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "friend_requests_sender_id_idx" ON "friend_requests"("sender_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "friend_requests_receiver_id_idx" ON "friend_requests"("receiver_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "friend_requests_status_idx" ON "friend_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "friendships_user1_id_user2_id_key" ON "friendships"("user1_id", "user2_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "friendships_user1_id_idx" ON "friendships"("user1_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "friendships_user2_id_idx" ON "friendships"("user2_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'friend_requests_sender_id_fkey'
  ) THEN
    ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'friend_requests_receiver_id_fkey'
  ) THEN
    ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'friendships_user1_id_fkey'
  ) THEN
    ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user1_id_fkey" FOREIGN KEY ("user1_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'friendships_user2_id_fkey'
  ) THEN
    ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user2_id_fkey" FOREIGN KEY ("user2_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;