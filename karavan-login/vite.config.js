import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    build: {
        rollupOptions: {
            input: {
                main: 'index.html',
                productSearch: 'product-search.html',
                home: 'home.html',
                settings: 'settings.html',
                sell: 'sell.html',
                profile: 'profile.html',
                notFound: '404.html'
            }
        }
    },
    server: {
        watch: {
            ignored: ['**/.vs/**']
        },
        // This creates a secure network bridge bypassing browser blocks completely
        proxy: {
            '/api': {
                target: 'https://buffalo.edu',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, '')
            }
        }
    }
})
