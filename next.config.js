/** @type {import("next").NextConfig} */
const nextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Hostinger's shared Linux image cannot load Next 16's native SWC binary.
  // Webpack can use the matching WASM compiler without changing app behavior.
  ...(process.env.COFI_HOSTINGER_BUILD === "1" ? {
    output: "standalone",
    experimental: { useWasmBinary: true },
  } : {}),
  async headers() {
    return [
      { source: "/sw.js", headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
      ] },
      { source: "/offline.html", headers: [
        { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" },
      ] },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

module.exports = nextConfig;
