-- CreateTable
CREATE TABLE "subtasks" (
    "id" TEXT NOT NULL,
    "work_task_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "due_date" TIMESTAMP(3),
    "start_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "assignee_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "tags" JSONB DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subtasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subtask_comments" (
    "id" TEXT NOT NULL,
    "subtask_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "subtask_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subtasks_work_task_id_status_idx" ON "subtasks"("work_task_id", "status");

-- CreateIndex
CREATE INDEX "subtasks_work_task_id_position_idx" ON "subtasks"("work_task_id", "position");

-- CreateIndex
CREATE INDEX "subtasks_status_idx" ON "subtasks"("status");

-- CreateIndex
CREATE INDEX "subtasks_assignee_id_idx" ON "subtasks"("assignee_id");

-- CreateIndex
CREATE INDEX "subtasks_created_by_id_idx" ON "subtasks"("created_by_id");

-- CreateIndex
CREATE INDEX "subtask_comments_subtask_id_idx" ON "subtask_comments"("subtask_id");

-- CreateIndex
CREATE INDEX "subtask_comments_user_id_idx" ON "subtask_comments"("user_id");

-- CreateIndex
CREATE INDEX "subtask_comments_created_at_idx" ON "subtask_comments"("created_at");

-- AddForeignKey
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_work_task_id_fkey" FOREIGN KEY ("work_task_id") REFERENCES "work_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtask_comments" ADD CONSTRAINT "subtask_comments_subtask_id_fkey" FOREIGN KEY ("subtask_id") REFERENCES "subtasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtask_comments" ADD CONSTRAINT "subtask_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;