import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg", "@react-pdf/renderer", "pdfkit"],
  outputFileTracingIncludes: {
    "/*": ["./migrations/**/*", "./public/brand/**/*", "./node_modules/pdfkit/js/**/*"],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["*.apps.grok.bot"],
      bodySizeLimit: "4mb",
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      canvas: false,
      encoding: false,
    };
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
