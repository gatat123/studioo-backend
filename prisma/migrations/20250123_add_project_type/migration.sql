-- AlterTable
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "project_type" VARCHAR(50) NOT NULL DEFAULT 'studio';