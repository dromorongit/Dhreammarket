/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    serverComponentsExternalPackages: [
      '@prisma/client',
      'prisma',
      '@prisma/adapter-pg',
      'cloudinary',
      'pg',
    ],
    optimizePackageImports: ['recharts', 'react-icons', 'lucide-react'],
  },
  images: {
    deviceSizes: [640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 2592000,
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'cloudinary.com',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    config.externals = [
      ...(config.externals || []),
      ({ context, request }, callback) => {
        if (
          request === '@prisma/client' ||
          request === 'prisma' ||
          request === '@prisma/adapter-pg' ||
          request === 'cloudinary' ||
          request === 'pg'
        ) {
          return callback(null, `commonjs ${request}`)
        }
        callback()
      },
    ]

    const webpack = require('webpack')
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:(.+)$/, (resource) => {
        resource.request = resource.request.replace(/^node:/, '')
      }),
    )

    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'node:crypto': 'crypto',
      'node:fs': 'fs',
      'node:os': 'os',
      'node:path': 'path',
      async_hooks: 'async_hooks',
      dns: 'dns',
      net: 'net',
    }

    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        dns: false,
        net: false,
        async_hooks: false,
        stream: false,
        buffer: false,
        util: false,
      }
    }

    return config
  },
  async headers() {
    const isProduction = process.env.NODE_ENV === 'production'

    const headers = [
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'X-Frame-Options',
        value: 'DENY',
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
      },
    ]

    if (isProduction) {
      headers.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      })
    }

    return [
      {
        source: '/(.*)',
        headers,
      },
    ]
  },
}

const { withSentryConfig } = require('@sentry/nextjs')

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.SENTRY_DSN,
  disableServerWebpackPlugin: !process.env.SENTRY_DSN,
  disableClientWebpackPlugin: !process.env.SENTRY_DSN,
  disableEdgeWebpackPlugin: !process.env.SENTRY_DSN,
  release: {
    name:
      process.env.NODE_ENV === 'production'
        ? require('./package.json').version
        : undefined,
  },
})