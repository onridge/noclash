"use server";

import { formValue } from "@/lib/form-data";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import z from "zod";

export const authWithGithub = async () => {
  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: `${siteUrl}/auth/callback` },
  });

  if (error || !data.url) {
    throw new Error(error?.message ?? "Could not start GitHub sign-in");
  }

  redirect(data.url);
};

export const signOut = async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
};

export type MagicLinkFormState =
  | { status: "idle" }
  | { status: "success"; email: string }
  | { status: "error"; error: string };

const emailSchema = z.object({
  email: z.email(),
});

export const signInWithMagicalLink = async (
  _prevState: MagicLinkFormState,
  formData: FormData,
): Promise<MagicLinkFormState> => {
  const email = formValue(formData, "email");

  const parsed = emailSchema.safeParse({ email: email });

  if (!parsed.success) {
    return { status: "error", error: "Enter a valid email address" };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${siteUrl}/auth/callback` },
  });

  if (error) {
    return {
      status: "error",
      error: "Could not send the sign-in link. Try again",
    };
  }

  return {
    status: "success",
    email: parsed.data.email,
  };
};
