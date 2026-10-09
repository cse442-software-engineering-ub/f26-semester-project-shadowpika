import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    // Cattle/Aptitude host the app below /CSE442/.../cse-442j rather than
    // at the domain root, so generated HTML must reference nearby assets.
    base: './',
    plugins: [react()],
    // All feature components share this frontend package's React installation.
    resolve: {
        dedupe: ['react', 'react-dom']
    },
    build: {
        rollupOptions: {
            output: {
                assetFileNames: (asset) => {
                    const name = asset.names?.[0] ?? asset.name ?? '';
                    return /\.(png|jpe?g|webp|gif|svg)$/i.test(name)
                        ? 'assets/images/[name]-[hash][extname]'
                        : 'assets/[name]-[hash][extname]';
                },
            },
            input: {
                main: 'index.html',
                register: 'register.html',
                productSearch: 'product-search.html',
                item: 'item.html',
                meet: 'meet.html',
                home: 'home.html',
                settings: 'settings.html',
                sell: 'sell.html',
                profile: 'profile.html',
                accountSettings: 'settings/account-settings.html',
                generalSettings: 'settings/general-settings.html',
                changePassword: 'settings/change-password.html',
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
        // Serve PHP from the assembled release, without dropping any API path prefix.
        proxy: {
            '^/.*\\.php(?:\\?|$)': {
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
