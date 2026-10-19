import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyRelease } from '../../scripts/verify/verify-release.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const deploy = path.join(repo, 'deploy');
const build = () => spawnSync(process.execPath, ['scripts/build/build-release.mjs'], { cwd: repo, encoding: 'utf8' });

test('a rebuild is deterministic and preserves an unmanaged runtime file', () => {
    verifyRelease(deploy, repo);
    const manifest = fs.readFileSync(path.join(deploy, 'release-manifest.json'), 'utf8');
    const marker = path.join(deploy, 'listing/uploads', `build-test-${crypto.randomUUID()}.txt`);
    try {
        fs.writeFileSync(marker, 'Runtime preservation test only.', { flag: 'wx' });
        const result = build();
        assert.equal(result.status, 0, result.stderr);
        assert.equal(fs.readFileSync(path.join(deploy, 'release-manifest.json'), 'utf8'), manifest);
        assert.equal(fs.readFileSync(marker, 'utf8'), 'Runtime preservation test only.');
    } finally { if (fs.existsSync(marker)) fs.unlinkSync(marker); }
});

test('a rebuild refuses to overwrite a manually edited generated page', () => {
    // Refuse to start unless existing files match the manifest: never erase a user's edit.
    verifyRelease(deploy, repo);
    const file = path.join(deploy, 'home.html');
    const original = fs.readFileSync(file);
    try {
        fs.appendFileSync(file, '<!-- simulated manual release edit -->');
        const result = build();
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /Edited release file: home.html/);
        assert.ok(fs.readFileSync(file, 'utf8').endsWith('<!-- simulated manual release edit -->'));
    } finally { fs.writeFileSync(file, original); }
});
