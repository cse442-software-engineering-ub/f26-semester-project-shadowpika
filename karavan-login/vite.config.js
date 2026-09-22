import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
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
