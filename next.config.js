/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 14 has App Router enabled by default
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma', 'cloudinary', 'pg']
  },
  webpack: (config, { isServer }) => {
    // Externalize Prisma packages to prevent webpack from bundling them
    // This is critical for both server and client builds
    if (isServer) {
      // Use function-based externals for proper handling of scoped packages
      // Array-based externals with scoped packages like @prisma/client
      // causes webpack to generate invalid JS: "const __WEBPACK_NAMESPACE_OBJECT__ = @prisma/client;"
      config.externals = [
        ...(config.externals || []),
        ({ context, request }, callback) => {
          if (request === '@prisma/client' || request === 'prisma' || request === '@prisma/adapter-pg' || request === 'cloudinary' || request === 'pg') {
            return callback(null, `commonjs ${request}`)
          }
          callback()
        }
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
          // Mutate resource.request in place - returning a value does not work
          resource.request = resource.request.replace(/^node:/, '')
        }
      )
    )

    // Also add resolve alias for node: protocol imports
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'node:crypto': 'crypto',
      'node:fs': 'fs',
      'node:os': 'os',
      'node:path': 'path',
    }

    return config
  }
}

module.exports = nextConfig