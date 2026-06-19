import type { NextConfig } from "next";

function originHost(value: string | undefined, fallback: string) {
  return new URL(value ?? fallback).hostname;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@celeris/shared", "@celeris/sdk-browser"],
  allowedDevOrigins: [
    originHost(process.env.NEXT_PUBLIC_SITE_ORIGIN, "https://home.celeris.pro"),
    originHost(process.env.NEXT_PUBLIC_DEVELOPER_APP_ORIGIN, "https://app.celeris.pro"),
    originHost(process.env.NEXT_PUBLIC_DEMO_FRONTEND_ORIGIN, "https://demo.celeris.pro"),
    originHost(process.env.NEXT_PUBLIC_HOSTED_AUTH_ORIGIN, "https://auth.celeris.pro")
  ]
};

export default nextConfig;
