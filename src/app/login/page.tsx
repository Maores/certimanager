import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo / Branding */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-7 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            CertiManager
          </h1>
          <p className="mt-1 text-sm text-muted">מערכת ניהול הסמכות</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-xl shadow-black/5">
          <h2 className="mb-6 text-lg font-semibold text-foreground">
            התחברות למערכת
          </h2>
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          &copy; {new Date().getFullYear()} CertiManager. כל הזכויות שמורות.
        </p>
      </div>
    </div>
  );
}
