// Generate a local, ignored deployment bundle without deleting environment-owned files.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { verifyRelease } from '../verify/verify-release.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const frontend = path.join(repo, 'frontend');
const deploy = path.join(repo, 'deploy');
const build = spawnSync(process.execPath, [path.join(frontend, 'node_modules/vite/bin/vite.js'), 'build'], {
    cwd: frontend, stdio: 'inherit',
});
if (build.status !== 0) process.exit(build.status ?? 1);

const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'karavan-release-'));
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function copy(source, relative = '') {
    const target = path.join(stage, relative);
    if (fs.statSync(source).isDirectory()) {
        fs.mkdirSync(target, { recursive: true });
        for (const name of fs.readdirSync(source).sort()) copy(path.join(source, name), path.join(relative, name));
    } else {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(source, target);
    }
}
function files(directory, prefix = '') {
    return fs.readdirSync(directory).sort().flatMap(name => {
        const relative = prefix + name;
        return fs.statSync(path.join(directory, name)).isDirectory()
            ? files(path.join(directory, name), relative + '/') : [relative];
    });
}
function safeManagedPath(base, relative) {
    if (!relative || relative.includes('\\') || relative.split('/').includes('..') || path.isAbsolute(relative)) {
        throw new Error(`Unsafe manifest path: ${relative}`);
    }
    const resolved = path.resolve(base, relative);
    if (!resolved.startsWith(base + path.sep)) throw new Error('Manifest path escaped release directory.');
    return resolved;
}
try {
    copy(path.join(frontend, 'dist'));
    copy(path.join(repo, 'backend/endpoints'));
    copy(path.join(repo, 'backend/includes'), 'includes');
    copy(path.join(repo, 'backend/listing/lib'), 'listing/lib');
    copy(path.join(repo, 'backend/server/.htaccess'), '.htaccess');
    copy(path.join(repo, 'backend/server/listing-uploads.htaccess'), 'listing/uploads/.htaccess');
    // Keep inbound URLs from older nested navbars working, without duplicate apps/bundles.
    const aliases = {
        'settings/index.html': '../index.html',
        'settings/home.html': '../home.html',
        'settings/product-search.html': '../product-search.html',
        'settings/sell.html': '../sell.html',
        'settings/settings.html': 'account-settings.html',
        'settings/admin-settings.html': '../settings.html',
        'settings/404.html': '../404.html',
    };
    for (const [file, destination] of Object.entries(aliases)) {
        const target = path.join(stage, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, `<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Karavan</title><meta http-equiv="refresh" content="0;url=${destination}"></head><body><a href="${destination}">Continue to Karavan</a></body></html>\n`);
    }
    const manifest = { format: 1, files: Object.fromEntries(files(stage).map(file => [file, hash(path.join(stage, file))])) };
    fs.writeFileSync(path.join(stage, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    verifyRelease(stage, repo);

    fs.mkdirSync(deploy, { recursive: true });
    const oldManifest = path.join(deploy, 'release-manifest.json');
    const previous = fs.existsSync(oldManifest) ? JSON.parse(fs.readFileSync(oldManifest, 'utf8')).files : {};
    // Validate every path and detect local edits before deleting or overwriting anything.
    for (const [file, expected] of Object.entries(previous)) {
        const target = safeManagedPath(deploy, file);
        if (fs.existsSync(target) && hash(target) !== expected) throw new Error(`Edited release file: ${file}. Move the edit back into source before rebuilding.`);
    }
    for (const file of Object.keys(manifest.files)) {
        const target = safeManagedPath(deploy, file);
        if (fs.existsSync(target) && !(file in previous) && hash(target) !== manifest.files[file]) {
            throw new Error(`Unmanaged file would be overwritten: ${file}. Back it up before rebuilding.`);
        }
    }
    // Only obsolete, unchanged application-owned files can be removed. Runtime is untouched.
    for (const file of Object.keys(previous)) {
        if (!(file in manifest.files)) {
            const target = safeManagedPath(deploy, file);
            if (fs.existsSync(target)) fs.unlinkSync(target);
        }
    }
    for (const file of [...Object.keys(manifest.files), 'release-manifest.json']) {
        const target = safeManagedPath(deploy, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(stage, file), target);
    }
    console.log(`Release assembled locally: deploy/ (${Object.keys(manifest.files).length} managed files). Do not commit generated deploy files.`);
} finally {
    // stage is a fresh directory created by this process, never a user/workspace path.
    fs.rmSync(stage, { recursive: true, force: true });
}
