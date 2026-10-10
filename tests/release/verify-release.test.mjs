import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyRelease } from '../../scripts/verify/verify-release.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
function fixture(run) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'karavan-release-test-'));
    try {
        // Copy only managed release files, never server config/runtime.
        const manifest = JSON.parse(fs.readFileSync(path.join(repo, 'deploy/release-manifest.json'), 'utf8'));
        for (const file of [...Object.keys(manifest.files), 'release-manifest.json']) {
            const target = path.join(directory, file);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.copyFileSync(path.join(repo, 'deploy', file), target);
        }
        run(directory, manifest);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}
function update(directory, manifest, file, contents) {
    fs.writeFileSync(path.join(directory, file), contents);
    manifest.files[file] = crypto.createHash('sha256').update(contents).digest('hex');
    fs.writeFileSync(path.join(directory, 'release-manifest.json'), JSON.stringify(manifest));
}

test('the generated release has valid local links below the course base path', () => {
    verifyRelease(path.join(repo, 'deploy'), repo);
});
test('an overwritten release file is detected by its digest', () => fixture((directory) => {
    fs.appendFileSync(path.join(directory, 'home.html'), '<!-- overwritten -->');
    assert.throws(() => verifyRelease(directory, repo), /Hash mismatch: home.html/);
}));
test('a missing image is detected even if the manifest was refreshed', () => fixture((directory, manifest) => {
    const file = 'home.html';
    const original = fs.readFileSync(path.join(directory, file), 'utf8');
    const changed = original.replace(/assets\/icons\/favicon\.svg/, 'assets/icons/missing.svg');
    assert.notEqual(changed, original, 'home.html should reference the favicon fixture');
    update(directory, manifest, file, changed);
    assert.throws(() => verifyRelease(directory, repo), /missing .*assets\/icons\/missing\.svg/);
}));
test('manifest traversal is rejected before reading outside the release', () => fixture((directory, manifest) => {
    manifest.files['../outside.txt'] = 'untrusted';
    fs.writeFileSync(path.join(directory, 'release-manifest.json'), JSON.stringify(manifest));
    assert.throws(() => verifyRelease(directory, repo), /Unsafe manifest path/);
}));
