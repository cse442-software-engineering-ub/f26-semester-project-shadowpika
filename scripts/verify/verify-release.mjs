import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const repoDefault = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

export function verifyRelease(directory, repo = repoDefault) {
    const errors = [];
    const release = path.resolve(directory);
    const manifest = JSON.parse(fs.readFileSync(path.join(release, 'release-manifest.json'), 'utf8'));
    if (manifest.format !== 1 || !manifest.files) throw new Error('Unsupported release manifest.');
    const { JSDOM } = createRequire(path.join(repo, 'frontend/package.json'))('jsdom');
    const localReference = (from, url) => {
        if (!url || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url)) return;
        // Every check runs below a simulated course subdirectory, not domain root.
        const base = 'https://example.invalid/CSE442/2026-Fall/cse-442j/';
        const resolved = new URL(url, new URL(from, base));
        if (!resolved.href.startsWith(base)) { errors.push(`${from}: escaped app base: ${url}`); return; }
        const file = decodeURIComponent(resolved.pathname.slice(new URL(base).pathname.length));
        if (!file || ['admin-register', 'moderator'].includes(file)) return;
        if (!fs.existsSync(path.join(release, file))) errors.push(`${from}: missing ${url}`);
    };
    for (const [file, expected] of Object.entries(manifest.files)) {
        if (file.includes('\\') || file.split('/').includes('..') || path.isAbsolute(file)) { errors.push(`Unsafe manifest path: ${file}`); continue; }
        const target = path.join(release, file);
        if (!fs.existsSync(target)) { errors.push(`Missing managed file: ${file}`); continue; }
        if (hash(target) !== expected) errors.push(`Hash mismatch: ${file}`);
        if (/(?:^|\/)(?:config\.local\.php|node_modules|\.git|\.env|sessions|runtime|vendor)(?:\/|$)/.test(file)) errors.push(`Environment/dependency file in release: ${file}`);
        if (file.endsWith('.html')) {
            const html = fs.readFileSync(target, 'utf8');
            const document = new JSDOM(html).window.document;
            for (const node of document.querySelectorAll('[src], [href]')) {
                localReference(file, node.getAttribute('src') ?? node.getAttribute('href'));
            }
            for (const node of document.querySelectorAll('script:not([src])')) {
                for (const match of node.textContent.matchAll(/(?:fetch|location\.(?:replace|assign))\(\s*['"]([^'"]+)/g)) localReference(file, match[1]);
            }
            if (html.includes('/src/') || html.includes('Nav-Settings.js')) errors.push(`Source/stale bundle reference: ${file}`);
        }
        if (file.endsWith('.css')) {
            for (const match of fs.readFileSync(target, 'utf8').matchAll(/url\(\s*['"]?([^\s'"\)]+)['"]?\s*\)/g)) localReference(file, match[1]);
        }
        if (file.endsWith('.js')) {
            const js = fs.readFileSync(target, 'utf8');
            for (const match of js.matchAll(/(?:from|import\(|export[^;]*?from)\s*["'](\.[^"']+\.js)["']/g)) localReference(file, match[1]);
            for (const match of js.matchAll(/['"](\.[^'"\n]+\.css)['"]/g)) localReference(file, match[1]);
        }
        if (file.endsWith('.php')) {
            const php = fs.readFileSync(target, 'utf8');
            for (const match of php.matchAll(/(?:require|include)(?:_once)?\s+__DIR__\s*\.\s*['"]([^'"]+)['"]/g)) {
                if (!fs.existsSync(path.resolve(path.dirname(target), '.' + match[1]))) errors.push(`${file}: missing PHP include ${match[1]}`);
            }
            // Reject the hardcoded credential patterns removed during this migration.
            if (/\$(?:db_password|db_pass|password|pass)\s*=\s*(?:getenv\([^;]+\)\s*\?:\s*)?['"][^'"]+['"]\s*;/i.test(php)) errors.push(`Literal database/password configuration: ${file}`);
        }
    }
    for (const file of ['home.html','product-search.html','sell.html','profile.html','settings.html','settings/account-settings.html','settings/change-password.html','item.html','meet.html','api/search_listings.php','listing/api/image.php']) {
        if (!(file in manifest.files)) errors.push(`Required route missing: ${file}`);
    }
    const profile = fs.readFileSync(path.join(release, 'profile.html'), 'utf8');
    if (!profile.includes('profile-header')) errors.push('Functional Profile was replaced by a placeholder.');
    if (errors.length) throw new Error(`Release verification failed:\n${errors.join('\n')}`);
    console.log(`Release references and SHA-256 manifest verified (${Object.keys(manifest.files).length} files).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    verifyRelease(process.argv[2] ?? path.join(repoDefault, 'deploy'));
}
