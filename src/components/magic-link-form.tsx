"use client";

import { MagicLinkFormState, signInWithMagicalLink } from "@/actions/auth";
import { useActionState, useState } from "react";

const initialState: MagicLinkFormState = { status: "idle" };

const inputClassName =
  "border border-rule bg-transparent px-3 py-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper";
const labelClassName = "flex flex-col gap-1.5 text-xs text-ink-muted";

export const MagicLinkForm = () => {
  const [state, formAction, isPending] = useActionState(
    signInWithMagicalLink,
    initialState,
  );

  const [dismissedState, setDismissedState] =
    useState<MagicLinkFormState | null>(null);

  const showError = state.status === "error" && state !== dismissedState;

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <label className={labelClassName}>
        Email
        <input type="email" name="email" required className={inputClassName} />
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="self-start bg-ink px-6 py-2.5 text-sm font-semibold text-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:opacity-50"
      >
        Send me a sign-in link
      </button>

      {showError && state.status === "error" && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 border-t-2 border-signal bg-signal-tint px-3 py-2"
        >
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-signal">
              {state.error}
            </span>
            <span className="text-xs text-ink-muted">
              Choose another time above.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDismissedState(state)}
            className="border border-rule px-3 py-1.5 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-signal-tint"
          >
            Got it
          </button>
        </div>
      )}

      {state.status === "success" && (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-accent">
            Check your email — sent a sign-in link to {state.email}.
          </p>
        </div>
      )}
    </form>
  );
};
