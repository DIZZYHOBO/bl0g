/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Remove output: 'export' for Netlify deployment
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // Add experimental features if needed
  experimental: {
    esmExternals: false,
  }
}

module.exports = nextConfig
