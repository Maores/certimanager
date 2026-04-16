// src/__tests__/lib-supabase-auth.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the server client factory so we can observe behavior
const getUserSpy = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserSpy },
  })),
}));

beforeEach(() => {
  getUserSpy.mockReset();
  getUserSpy.mockResolvedValue({
    data: { user: { id: "user-1", email: "a@b.co" } },
  });
  vi.resetModules();
});

describe("getAuthenticatedUser", () => {
  it("returns the Supabase user", async () => {
    const { getAuthenticatedUser } = await import("@/lib/supabase/auth");
    const user = await getAuthenticatedUser();
    expect(user).toEqual({ id: "user-1", email: "a@b.co" });
  });

  it("returns null when Supabase returns no user", async () => {
    getUserSpy.mockResolvedValue({ data: { user: null } });
    const { getAuthenticatedUser } = await import("@/lib/supabase/auth");
    const user = await getAuthenticatedUser();
    expect(user).toBeNull();
  });

  // NOTE: We deliberately do NOT assert React cache() dedup here. React 19
  // has two cache() implementations selected by package.json export
  // conditions: the client build is a pass-through no-op; the `react-server`
  // build does the real memoization via ReactSharedInternals. Vitest resolves
  // to the client build, so dedup would not be observable. Forcing the
  // `react-server` condition globally would break the existing jsdom
  // component tests. Dedup is a React+Next.js library contract we rely on
  // at production runtime; verified instead via before/after measurements
  // (Task 8).
});
