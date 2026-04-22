/** @type {import('next').NextConfig} */
const nextConfig = {
  // The ingestion pipeline writes book text under /storage/books. These are
  // loaded at request-time via fs.readFile — nothing needs to be bundled.
  outputFileTracingIncludes: {
    "/book/*": ["./storage/books/**"],
  },
  experimental: {
    // Allow turbopack while remaining compatible with webpack fallback.
  },
};
export default nextConfig;
