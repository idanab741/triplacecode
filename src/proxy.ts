import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/services/supabase/session";

const PROTECTED_PATHS = [
  "/home",
  "/profile-setup",
  "/preferences",
  "/profile",
  "/favorites",
  "/community",
  "/ai",
  "/search",
  "/destination",
  "/place",
  "/trip-builder",
  "/trips",
  "/tripmatch",
];

const GUEST_ALLOWED_PATHS = ["/home"];

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));

  if (isProtected && !user) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  const isGuest = Boolean(user?.is_anonymous);
  const isGuestAllowed = GUEST_ALLOWED_PATHS.some((path) => pathname.startsWith(path));

  if (isProtected && isGuest && !isGuestAllowed) {
    const url = new URL("/register-required", request.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
