/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Isso faz a Vercel ignorar erros de TypeScript no build
  typescript: {
    ignoreBuildErrors: true,
  },
  // Isso faz a Vercel ignorar erros de ESLint no build
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig