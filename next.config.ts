import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Codespaces and other proxied dev hosts serve the app on a different
    // origin than the forwarded host header, which Server Actions reject.
    serverActions: { allowedOrigins: ["*.app.github.dev", "localhost:3000"] },
    // Enables forbidden() / unauthorized() used by src/lib/rbac.ts.
    // Requires Next 15.1+. On an older Next, delete this line and replace those
    // calls in src/lib/rbac.ts with notFound() / redirect("/signin").
    authInterrupts: true,
  },
  // typedRoutes is deliberately off: it rejects the template-literal hrefs used
  // throughout (`/campaigns/${id}`) and fails the build with a type error.
  // Turn it back on only alongside a typed route-builder helper.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.cdninstagram.com" },
      { protocol: "https", hostname: "**.tiktokcdn.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
