import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'reproducibility/preserved-files.json'),'utf8'));
for(const [file,hash] of Object.entries(manifest.files)){
  assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),hash,`Protected file changed: ${file}`);
}
console.log(`PASS: ${Object.keys(manifest.files).length} protected geometry/model/solver/worker/style/data/validation files are byte-identical to the integrated source.`);
