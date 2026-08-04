CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"timezone" text NOT NULL,
	"slot_minutes" integer DEFAULT 60 NOT NULL,
	"buffer_minutes" integer DEFAULT 0 NOT NULL,
	"max_advance_days" integer DEFAULT 60 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resources_slug_unique" UNIQUE("slug"),
	CONSTRAINT "resources_slot_minutes_range" CHECK ("resources"."slot_minutes" between 5 and 480),
	CONSTRAINT "resources_buffer_minutes_nonneg" CHECK ("resources"."buffer_minutes" >= 0)
);
