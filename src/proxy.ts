import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/services/supabase/session";

/** נתיבים שדורשים משתמש מחובר. */
const PROTECTED_PATHS = [
  "/home",
  "/profile-setup",
  "/preferences",
  "/profile",
  "/favorites",
  "/community",
  "/ai",
  "/search",
  "/place",
];

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);

  const isProtected = PROTECTED_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtected && !user) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
