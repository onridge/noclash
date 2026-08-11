CREATE TABLE "availability_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"on_date" date NOT NULL,
	"is_closed" boolean DEFAULT true NOT NULL,
	"starts_at" time,
	"ends_at" time,
	CONSTRAINT "availability_exceptions_resource_date_unique" UNIQUE("resource_id","on_date"),
	CONSTRAINT "availability_exceptions_closed_or_has_times" CHECK ("availability_exceptions"."is_closed" OR ("availability_exceptions"."starts_at" IS NOT NULL AND "availability_exceptions"."ends_at" IS NOT NULL) )
);
--> statement-breakpoint
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;