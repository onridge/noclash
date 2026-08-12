"use client";

import { createResourceFromForm, ResourceFormState } from "@/actions/resources";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { TimeZonePicker } from "./timezone-picker";

const initialState: ResourceFormState = { status: "idle" };

const inputClassName =
  "border border-rule bg-transparent px-3 py-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper";
const labelClassName = "flex flex-col gap-1.5 text-xs text-ink-muted";

export function ResourceForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    createResourceFromForm,
    initialState,
  );

  const [dissmissedState, setDismissedState] =
    useState<ResourceFormState | null>(null);

  useEffect(() => {
    if (state.status === "success") {
      router.push(`/resources/${state.resources.slug}`);
    }
  }, [state, router]);

  const showError = state.status === "error" && state !== dissmissedState;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className={labelClassName}>
        Your user ID (temporary — Phase 3 adds real accounts)
        <input
          type="text"
          name="ownerId"
          required
          className={`${inputClassName} font-mono`}
        />
      </label>

      <label className={labelClassName}>
        Name
        <input
          type="text"
          name="name"
          required
          placeholder="Rehearsal Room B"
          className={inputClassName}
        />
      </label>

      <TimeZonePicker name="timezone" />

      <button
        type="submit"
        disabled={isPending}
        className="self-start bg-ink px-6 py-2.5 text-sm font-semibold text-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:opacity-50"
      >
        {isPending ? "Creating..." : "Create resource"}
      </button>

      {showError && state.status === "error" && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 border-t-2 border-signal bg-signal-tint px-3 py-2"
        >
          <span className="text-sm font-semibold text-signal">
            {state.error}
          </span>

          <button
            type="button"
            onClick={() => setDismissedState(state)}
            className="border border-rule px-3 py-1.5 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-signal-tint"
          >
            Got it
          </button>
        </div>
      )}
    </form>
  );
}
