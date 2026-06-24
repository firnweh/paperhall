/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Book text is served as static files from /public/books/<id>/content.html and
  // fetched by the reader on the client — nothing needs server-side bundling.
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        source: "/books/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
