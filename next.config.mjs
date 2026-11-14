// BUILD_TARGET=android produces the static export (out/) bundled in the APK.
// The server route app/api/time/route.ts is then left out (pageExtensions is
// limited to .tsx/.jsx): the Android app syncs its clock with an external source.
const isAndroid = process.env.BUILD_TARGET === "android"

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  ...(isAndroid
    ? {
        output: "export",
        pageExtensions: ["tsx", "jsx"],
      }
    : {
        // Web deployment only (headers are not available in a static export).
        async headers() {
          return [{ source: "/:path*", headers: securityHeaders }]
        },
      }),
}

export default nextConfig
