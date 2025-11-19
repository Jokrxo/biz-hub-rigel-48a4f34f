import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.supabase\.co/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif)/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ]
      },
      manifest: {
        name: 'ApexAccounts - Accounting Management System',
        short_name: 'ApexAccounts',
        description: 'Professional accounting and financial management system with VAT tracking, loan management, and comprehensive reporting',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#2563eb',
        orientation: 'portrait-primary',
        icons: [
          {
            src: 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22192%22 height=%22192%22><rect width=%22192%22 height=%22192%22 rx=%2224%22 fill=%22%232563eb%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22white%22 font-family=%22Arial%22 font-size=%2272%22>AA</text></svg>',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22512%22 height=%22512%22><rect width=%22512%22 height=%22512%22 rx=%2240%22 fill=%22%232563eb%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22white%22 font-family=%22Arial%22 font-size=%22200%22>AA</text></svg>',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ],
        categories: ['finance', 'business', 'productivity'],
        shortcuts: [
          {
            name: 'New Transaction',
            short_name: 'Transaction',
            description: 'Quickly add a new transaction',
            url: '/transactions/new',
            icons: [{ src: '/icons/transaction.png', sizes: '192x192' }]
          },
          {
            name: 'View Reports',
            short_name: 'Reports',
            description: 'View financial reports',
            url: '/reports',
            icons: [{ src: '/icons/reports.png', sizes: '192x192' }]
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true
  },
  preview: {
    port: 5173,
    strictPort: true,
    host: true
  }
})