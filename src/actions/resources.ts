"use server";

import { createDb, db } from "@/db/client";
import { extractPostgresCode } from "@/db/errors";
import { resources } from "@/db/schema";
import { formValue } from "@/lib/form-data";
import { slugify } from "@/lib/slugify";
import z from "zod";

const IANA_TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"));

export interface ResourceDto {
  id: string;
  name: string;
  slug: string;
  timezone: string;
}

const createResourceSchema = z.object({
  ownerId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  timezone: z.string().refine((tz) => IANA_TIMEZONES.has(tz), {
    message: "Not a recognized IANA timezone",
  }),
});

export type CreateResourceResult =
  | {
      success: true;
      resource: ResourceDto;
    }
  | { success: false; error: string };

export async function createResource(
  input: unknown,
  client: ReturnType<typeof createDb> = db,
): Promise<CreateResourceResult> {
  const parsed = createResourceSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid resource details",
    };
  }

  try {
    const [resource] = await client
      .insert(resources)
      .values({
        ownerId: parsed.data.ownerId,
        name: parsed.data.name,
        slug: slugify(parsed.data.name),
        timezone: parsed.data.timezone,
      })
      .returning();

    if (!resource) throw new Error("insert returned no row");

    return { success: true, resource };
  } catch (error) {
    if (extractPostgresCode(error) === "23505") {
      return {
        success: false,
        error: "A resource with that name already exists",
      };
    }
    return {
      success: false,
      error: "Something went wrong creating this resource",
    };
  }
}

export type ResourceFormState =
  | { status: "idle" }
  | { status: "success"; resources: ResourceDto }
  | { status: "error"; error: string };

export async function createResourceFromForm(
  _prevState: ResourceFormState,
  formData: FormData,
  client: ReturnType<typeof createDb> = db,
): Promise<ResourceFormState> {
  const ownerId = formValue(formData, "ownerId");
  const name = formValue(formData, "name");
  const timezone = formValue(formData, "timezone");

  const result = await createResource(
    {
      ownerId,
      name,
      timezone,
    },
    client,
  );

  if (!result.success) {
    return { status: "error", error: result.error };
  }

  return { status: "success", resources: result.resource };
}
