/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['pbs.twimg.com', 'i.ytimg.com', 'yt3.ggpht.com'],
  },
  // src/instrumentation.ts: hydrates process.env from lab/settings/keys.json at boot (in-app API keys; env wins).
  // Still experimental on Next 14 (stable in 15). A change here needs a dev-server restart.
  experimental: { instrumentationHook: true },
}

export default nextConfig
