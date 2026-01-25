/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ignora erros de TypeScript no build
  typescript: {
    ignoreBuildErrors: true,
  },
  // Ignora erros de Lint no build
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig