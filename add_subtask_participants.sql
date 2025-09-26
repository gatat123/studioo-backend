-- Add SubTaskParticipant table
CREATE TABLE IF NOT EXISTS "SubTaskParticipants" (
    "id" TEXT NOT NULL,
    "subtask_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubTaskParticipants_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "SubTaskParticipants_subtaskId_userId_key" ON "SubTaskParticipants"("subtask_id", "user_id");

-- Create indexes
CREATE INDEX IF NOT EXISTS "SubTaskParticipants_subtask_id_idx" ON "SubTaskParticipants"("subtask_id");
CREATE INDEX IF NOT EXISTS "SubTaskParticipants_user_id_idx" ON "SubTaskParticipants"("user_id");

-- Add foreign key constraints
ALTER TABLE "SubTaskParticipants"
    ADD CONSTRAINT "SubTaskParticipants_subtask_id_fkey"
    FOREIGN KEY ("subtask_id") REFERENCES "SubTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubTaskParticipants"
    ADD CONSTRAINT "SubTaskParticipants_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;