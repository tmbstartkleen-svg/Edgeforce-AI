import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    '/api/release/bootstrap': ['./db/**/*.sql'],
  },
};
export default nextConfig;
