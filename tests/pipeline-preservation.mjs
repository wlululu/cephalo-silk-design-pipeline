import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {test} from 'node:test';
import {SOURCE, verifyPreservation} from '../pipeline/bridge-backend.mjs';

const root = path.resolve(import.meta.dirname, '..');
process.chdir(root);

test('actual UI-modified tree passes with only the two explicit presentation exceptions', () => {
 const report = verifyPreservation();
 assert.deepEqual(report.allowed_existing_file_changes,
  ['README.md', 'package.json', 'main.tsx', 'shared/Platform.tsx']);
 assert.equal(report.unchanged, true);
 for (const file of ['cases/bridge/BridgeCase.tsx', 'cases/bridge/BridgeView.tsx',
  'cases/bridge/geometry.mjs', 'cases/bridge/model.mjs', 'public/cases/bridge/model.json',
  'public/cases/bridge/solver.mjs', 'public/cases/bridge/hybrid.mjs',
  'public/cases/bridge/frame-element.mjs', 'public/cases/loop-towers/solver.js',
  'public/cases/pavilion/solver.js']) assert.ok(report.files[file], `Not protected: ${file}`);
});

test('model and solver mutations fail preservation in isolated file copies', () => {
 const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cephalo-preservation-'));
 const files = execFileSync('git', ['ls-tree', '-r', '--name-only', SOURCE], {encoding:'utf8'}).trim().split('\n');
 try {
  // Read the real immutable Git objects, but hash only these isolated working files.
  const gitDirectory = execFileSync('git', ['rev-parse', '--absolute-git-dir'], {encoding:'utf8'}).trim();
  fs.symlinkSync(gitDirectory, path.join(temporary, '.git'), 'dir');
  for (const file of files) {
   const target = path.join(temporary, file);
   fs.mkdirSync(path.dirname(target), {recursive:true}); fs.copyFileSync(path.join(root, file), target);
  }
  process.chdir(temporary);
  assert.equal(verifyPreservation().unchanged, true);
  for (const file of ['public/cases/bridge/model.json', 'public/cases/bridge/solver.mjs']) {
   const original = fs.readFileSync(file);
   try {
    fs.appendFileSync(file, '\n'); // A byte change must fail even when numerically innocuous.
    assert.throws(() => verifyPreservation(), error =>
     error?.code === 'ERR_ASSERTION' && error.message.includes(`Protected source changed: ${file}`));
   } finally {fs.writeFileSync(file, original);}
  }
 } finally {
  process.chdir(root);
  fs.rmSync(temporary, {recursive:true, force:true});
 }
});
