import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '담 플래너',
    short_name: '담 플래너',
    description: '주간 플래너, 노트, 말씀, 캘린더',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#faf5ff',
    theme_color: '#7c3aed',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
