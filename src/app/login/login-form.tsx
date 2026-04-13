"use client";

import { useActionState } from "react";
import { login, guestLogin } from "./actions";
import { Loader2, LogIn, UserCheck } from "lucide-react";

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    async (_prevState: { error: string } | null, formData: FormData) => {
      const result = await login(formData);
      return result ?? null;
    },
    null
  );

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-5">
        {state?.error && (
          <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
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
            className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-colors"
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
            className="block w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors cursor-pointer"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          {isPending ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              מתחבר...
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 justify-center">
              <LogIn className="h-4 w-4" strokeWidth={2} />
              כניסה
            </span>
          )}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-card px-3 text-muted-foreground">או</span>
        </div>
      </div>

      <form action={guestLogin}>
        <button
          type="submit"
          className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 transition-colors cursor-pointer"
        >
          <span className="inline-flex items-center gap-2 justify-center">
            <UserCheck className="h-4 w-4" strokeWidth={2} />
            כניסת אורח
          </span>
        </button>
      </form>
    </div>
  );
}
