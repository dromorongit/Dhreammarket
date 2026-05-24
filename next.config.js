/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 14 has App Router enabled by default
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma']
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize Prisma packages to prevent webpack from bundling them
      config.externals = [
        ...(config.externals || []),
        '@prisma/client',
        'prisma',
        '@prisma/adapter-pg'
      ]
    }

    // Handle node: protocol imports by replacing them with regular imports
    // This is needed for both server and client builds because Prisma Client v7
    // uses node: prefixed imports (e.g. node:crypto, node:fs) which webpack
    // cannot resolve by default.
    const webpack = require('webpack')
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /^node:(.+)$/,
        (resource) => {
          return resource.replace(/^node:/, '')
        }
      )
    )

    return config
  }
}

module.exports = nextConfig