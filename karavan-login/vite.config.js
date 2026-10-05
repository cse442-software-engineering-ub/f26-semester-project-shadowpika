import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    // Cattle/Aptitude host the app below /CSE442/.../cse-442j rather than
    // at the domain root, so generated HTML must reference nearby assets.
    base: './',
    plugins: [react()],
    // Listing feature components live beside the app package in ../listing/frontend.
    // Resolve every component against this app's single React installation.
    resolve: {
        dedupe: ['react', 'react-dom']
    },
    build: {
        rollupOptions: {
            input: {
                main: 'index.html',
                register: 'register.html',
                productSearch: 'product-search.html',
                item: 'item.html',
                home: 'home.html',
                settings: 'settings.html',
                sell: 'sell.html',
                profile: 'profile.html',
                notFound: '404.html'
            }
        }
    },
    server: {
        fs: {
            allow: ['..']
        },
        watch: {
            ignored: ['**/.vs/**']
        },
        // This creates a secure network bridge bypassing browser blocks completely
        proxy: {
            '/api': {
                target: 'https://buffalo.edu',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, '')
            },
            // Local backend: run `php -S localhost:8000` from the repo root.
            '^/[^/]+\\.php': {
                target: 'http://localhost:8000',
                changeOrigin: true
            }
        }
    },
    test: {
        environment: 'jsdom',
        setupFiles: './src/test/setup.js',
        css: false
    }
})
