import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, findUserBySessionToken } from "@/lib/auth/session";

// Admin pages check the role inside <Suspense>, where forbidden() can show the
// 403 page but not change the status (streaming has already started). This
// check runs first so non-admins get a real 403 status. It's the outer layer
// only: every admin page and Server Action still calls requireAdmin().
export const config = {
  matcher: ["/admin", "/admin/:path*"],
};

const FORBIDDEN_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<title>403 Forbidden</title></head>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem">
<h1>403 Forbidden</h1><p>You don't have access to this page.</p><p><a href="/">Return home</a></p>
</body></html>`;

export function proxy(request: NextRequest) {
  const user = findUserBySessionToken(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return NextResponse.redirect(new URL("/sign-in", request.url));
  if (user.role !== "admin") {
    return new NextResponse(FORBIDDEN_HTML, {
      status: 403,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  return NextResponse.next();
}
