import fs from 'node:fs'
import { createHash } from 'node:crypto'
const ledger = JSON.parse(fs.readFileSync('audit/tcu-migration.json', 'utf8'))
const files = ledger.evidence?.files || {}
const changed = []
for (const [file, expected] of Object.entries(files)) {
  if (!fs.existsSync(file)) { changed.push([file, 'MISSING']); continue }
  const actual = createHash('sha256').update(fs.readFileSync(file)).digest('hex')
  if (actual !== expected) changed.push([file, 'HASH'])
}
console.log('evidence files:', Object.keys(files).length, 'changed:', changed.length)
for (const [file, why] of changed) console.log(why, file)
