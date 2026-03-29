import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// createRouteMatcher is like a secondary match done by clerk, not dependent on next.js

const isPublicRoute = createRouteMatcher(["/signin", "/signup", "/", "/home"]);
const isPublicApiRoute = createRouteMatcher(["/api/videos"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth(); // make sure to await this!
  const currentUrl = new URL(req.url); // sometimes req.url doesn't work, so wrap it in new URL() so we know it is always a url
  const isAccessingDashboard = currentUrl.pathname === "/home";
  const isApiRequest = currentUrl.pathname.startsWith("/api");

  if (userId && isPublicRoute(req) && !isAccessingDashboard) {
    // redirect him to the home page (because he is logged in and trying to access the login page or sign up page.)
    return NextResponse.redirect(new URL("/home", req.url));
  }

  // not logged in
  if (!userId) {
    // not logged in and trying to access something else that only a logged in user can (aka a protected route)
    if (!isPublicApiRoute(req) && !isPublicRoute(req)) {
      // force user to login
      return NextResponse.redirect(new URL("/signin", req.url));
    }

    if (isApiRequest && !isPublicApiRoute(req)) {
      // starting with /api but NOT part of the public api, aka a protected api but user is not logged in
      return NextResponse.redirect(new URL("/signin", req.url));
    }
  }
  return NextResponse.next(); // move the request to the next stage, like the next middleware etc. MUST HAVE.
});

export const config = {
  // this is a negative match, the "/" so middleware will run on all routes except those indicated in the []
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};

// we want to customize the middleware, default is it protects ALL the routes, but we want some routes to be accessible to everyone in our web-app, so they can download videos etc.
