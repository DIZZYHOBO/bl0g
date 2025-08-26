/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // Webpack configuration to handle server-side modules
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't resolve server-side modules on the client
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        'react-dom/server': false,
      };
    }
    
    return config;
  },
}

module.exports = nextConfig
