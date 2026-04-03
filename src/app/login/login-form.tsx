"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    async (_prevState: { error: string } | null, formData: FormData) => {
      const result = await login(formData);
      return result ?? null;
    },
    null
  );

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-foreground mb-1.5"
        >
          אימייל
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="name@company.com"
          dir="ltr"
          className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-colors"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-foreground mb-1.5"
        >
          סיסמה
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          dir="ltr"
          className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-colors"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors cursor-pointer"
      >
        {isPending ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            מתחבר...
          </span>
        ) : (
          "כניסה"
        )}
      </button>
    </form>
  );
}
