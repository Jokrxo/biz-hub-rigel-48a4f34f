import path from 'path'

export default () => ({
  root: __dirname,
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 8080,
    strictPort: true,
    hmr: { overlay: false },
  },
  plugins: [],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})