ALTER TABLE "query_history" ADD COLUMN "status" varchar(20) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "query_history" ADD COLUMN "is_golden" boolean DEFAULT false NOT NULL;