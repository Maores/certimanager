import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasGuestSession } from "@/lib/guest-store";

const GUEST_COOKIE = "guest_session";

export async function middleware(request: NextRequest) {
  // Guest sessions bypass Supabase auth entirely — but validate the cookie value
  // against the server-side sessions Map to prevent cookie forgery.
  const guestCookieId = request.cookies.get(GUEST_COOKIE)?.value;
  const isGuest = guestCookieId ? hasGuestSession(guestCookieId) : false;

  if (isGuest) {
    // Guest trying to access login → redirect to dashboard
    if (request.nextUrl.pathname.startsWith("/login")) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    // Guest accessing dashboard or other pages → allow through
    return NextResponse.next({ request });
  }

  // Track whether we need to purge a forged/expired guest cookie from the response
  const shouldDeleteGuestCookie = !!guestCookieId && !isGuest;

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login
  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from login
  if (user && request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Delete forged/expired guest cookie so the browser stops sending it
  if (shouldDeleteGuestCookie) {
    supabaseResponse.cookies.delete(GUEST_COOKIE);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
