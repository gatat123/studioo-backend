-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studio_id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "deadline" DATETIME,
    "tag" TEXT,
    "invite_code" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "has_updates" BOOLEAN NOT NULL DEFAULT false,
    "overall_story" TEXT,
    "set_list" TEXT,
    "character_list" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" DATETIME,
    "archived_by" TEXT,
    "deletion_date" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "projects_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "projects_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_projects" ("character_list", "created_at", "creator_id", "deadline", "description", "has_updates", "id", "invite_code", "name", "overall_story", "set_list", "status", "studio_id", "tag", "updated_at") SELECT "character_list", "created_at", "creator_id", "deadline", "description", "has_updates", "id", "invite_code", "name", "overall_story", "set_list", "status", "studio_id", "tag", "updated_at" FROM "projects";
DROP TABLE "projects";
ALTER TABLE "new_projects" RENAME TO "projects";
CREATE UNIQUE INDEX "projects_invite_code_key" ON "projects"("invite_code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
