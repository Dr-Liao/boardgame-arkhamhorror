import fs from 'node:fs'
import { createHash } from 'node:crypto'
const ledger = JSON.parse(fs.readFileSync('audit/tcu-migration.json', 'utf8'))
const files = ledger.evidence?.files || {}
const h = b => createHash('sha256').update(b).digest('hex')
for (const [file, expected] of Object.entries(files)) {
  const raw = fs.readFileSync(file)
  const lf = Buffer.from(raw.toString('utf8').replace(/\r\n/g, '\n'), 'utf8')
  const crlf = Buffer.from(raw.toString('utf8').replace(/\r?\n/g, '\r\n'), 'utf8')
  const matchesRaw = h(raw) === expected, matchesLf = h(lf) === expected, matchesCrlf = h(crlf) === expected
  if (!matchesRaw) console.log(file, { matchesLf, matchesCrlf, crlfInFile: raw.includes(13) })
}
