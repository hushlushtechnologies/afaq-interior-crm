import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  logging: { serverFunctions: false },
  serverExternalPackages: ['sharp', 'pdf-lib'],
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
