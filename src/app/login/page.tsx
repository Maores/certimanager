import LoginForm from "./login-form";
import { Award } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo / Branding */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary" style={{ boxShadow: "0 8px 16px -4px rgba(37, 99, 235, 0.3)" }}>
            <Award className="h-7 w-7 text-white" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            CertiManager
          </h1>
          <p className="mt-1 text-sm text-muted">מערכת ניהול הסמכות</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-8" style={{ boxShadow: "var(--shadow-lg)" }}>
          <h2 className="mb-6 text-lg font-semibold text-foreground">
            התחברות למערכת
          </h2>
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} CertiManager. כל הזכויות שמורות.
        </p>
      </div>
    </div>
  );
}
