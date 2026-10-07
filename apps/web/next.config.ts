import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // next-intl ships untranspiled ESM, and so do its runtime dependencies.
  // Vite/vinext handles ESM natively at build time, but `next/jest` derives its
  // transform allow-list from this option — without these entries the unit tests
  // cannot even `require` next-intl.
  transpilePackages: [
    "next-intl",
    "use-intl",
    "intl-messageformat",
    "icu-minify",
    "@formatjs/fast-memoize",
    "@formatjs/icu-messageformat-parser",
    "@formatjs/icu-skeleton-parser",
    "@formatjs/intl-localematcher",
    "@schummar/icu-type-parser",
  ],
};

export default nextConfig;
