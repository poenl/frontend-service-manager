import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ['*.local'],
  // standalone 模式：构建产物为自包含 Node 服务器，供 fsm CLI 直接运行
  output: 'standalone'
}

export default nextConfig
