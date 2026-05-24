/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 14 has App Router enabled by default
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma']
  }
}

module.exports = nextConfig