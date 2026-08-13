"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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
