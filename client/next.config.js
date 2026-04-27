/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',  // For static Render deploy
  trailingSlash: true,
  images: { unoptimized: true },
}

module.exports = nextConfig

