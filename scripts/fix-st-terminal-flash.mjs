import assert from 'node:assert/strict';
import { constants, copyFileSync, existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Keep command-exists 1.2.9's Windows checks from opening a terminal. */
export function ensureSilentCommandExists(runtimeDirectory) {
    const runtime = path.resolve(runtimeDirectory);
    const require = createRequire(path.join(runtime, 'package.json'));
    const manifest = require('command-exists/package.json');
    assert.equal(manifest.name, 'command-exists');
    assert.equal(manifest.version, '1.2.9', 'Review the Windows patch for this command-exists version');
    // Test runtimes may share node_modules with the daily installation. Keep it read-only.
    const source = realpathSync(require.resolve('command-exists/lib/command-exists.js'));
    const target = path.join(runtime, 'src', 'command-exists-silent.cjs');
    const before = readFileSync(source, 'utf8');
    const newline = before.includes('\r\n') ? '\r\n' : '\n';
    const syncBefore = "execSync('where ' + cleanedCommandName, {stdio: []})";
    const syncAfter = "execSync('where ' + cleanedCommandName, {stdio: [], windowsHide: true})";
    const asyncBefore = "var child = exec('where ' + cleanedCommandName," + newline;
    const asyncAfter = asyncBefore + '    { windowsHide: true },' + newline;
    let after = before;
    for (const [original, fixed] of [[syncBefore, syncAfter], [asyncBefore, asyncAfter]]) {
        if (after.includes(fixed)) continue;
        assert.equal(after.split(original).length - 1, 1, 'Unexpected command-exists source; no changes made');
        after = after.replace(original, fixed);
    }
    const edits = [];
    for (const [file, replacement] of [
        ['util.js', './command-exists-silent.cjs'],
        ['plugin-loader.js', './command-exists-silent.cjs'],
        ['git/client.js', '../command-exists-silent.cjs'],
    ]) {
        const importer = path.join(runtime, 'src', file);
        if (!existsSync(importer) && file !== 'util.js') continue;
        const text = readFileSync(importer, 'utf8');
        const original = "from 'command-exists'";
        const fixed = `from '${replacement}'`;
        if (text.includes(fixed)) continue;
        assert.equal(text.split(original).length - 1, 1, `Unexpected import in ${importer}; no changes made`);
        edits.push({ importer, text: text.replace(original, fixed) });
    }
    const changed = !existsSync(target) || readFileSync(target, 'utf8') !== after || edits.length > 0;
    if (changed) writeFileSync(target, after, 'utf8');
    for (const { importer, text } of edits) {
        const backup = importer + '.before-terminal-flash';
        if (!existsSync(backup)) copyFileSync(importer, backup, constants.COPYFILE_EXCL);
        writeFileSync(importer, text, 'utf8');
    }
    return {
        runtime, source, target, changed, updatedImports: edits.map(edit => edit.importer),
        sha256: createHash('sha256').update(after).digest('hex'),
    };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    assert.equal(process.argv.length, 3, 'Usage: node scripts/fix-st-terminal-flash.mjs <SillyTavern runtime>');
    console.log(JSON.stringify(ensureSilentCommandExists(process.argv[2]), null, 2));
}
