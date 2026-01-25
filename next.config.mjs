/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Força a Vercel a ignorar erros de TypeScript na hora de subir
  typescript: {
    ignoreBuildErrors: true,
  },
  // Força a Vercel a ignorar erros de regras de código (Lint)
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig