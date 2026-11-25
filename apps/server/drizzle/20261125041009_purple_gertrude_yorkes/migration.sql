CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY,
	"task" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL,
	"detail" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "job_runs_task_started_at_idx" ON "job_runs" ("task","started_at");