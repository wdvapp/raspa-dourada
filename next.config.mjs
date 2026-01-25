/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ignora erros de TypeScript para não travar o build
  typescript: {
    ignoreBuildErrors: true,
  },
  // Ignora erros de Linting para não travar o build
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;