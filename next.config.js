/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma', 'cloudinary', 'pg']
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cloudinary.com',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // Externalize Prisma packages to prevent webpack from bundling them
    // This is critical for both server and client builds
    config.externals = [
      ...(config.externals || []),
      ({ context, request }, callback) => {
        if (request === '@prisma/client' || request === 'prisma' || request === '@prisma/adapter-pg' || request === 'cloudinary' || request === 'pg') {
          return callback(null, `commonjs ${request}`)
        }
        callback()
      }
    ]

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
      'async_hooks': 'async_hooks',
      'dns': 'dns',
      'net': 'net',
    }

    // Provide fallbacks for Node.js core modules in non-server context
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        'fs': false,
        'dns': false,
        'net': false,
        'async_hooks': false,
        'stream': false,
        'buffer': false,
        'util': false,
      }
    }

    return config
  }
}

module.exports = nextConfig