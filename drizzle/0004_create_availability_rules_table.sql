CREATE TABLE "availability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"starts_at" time NOT NULL,
	"ends_at" time NOT NULL,
	"effective_from" date,
	"effective_to" date,
	CONSTRAINT "availability_rules_weekday_range" CHECK ("availability_rules"."weekday" between 0 and 6),
	CONSTRAINT "availability_rules_ends_after_starts" CHECK ("availability_rules"."ends_at" > "availability_rules"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;