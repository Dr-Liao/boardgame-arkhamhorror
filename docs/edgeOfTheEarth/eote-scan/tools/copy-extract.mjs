import { readFileSync, writeFileSync } from 'node:fs'
const src = readFileSync('artifacts/eote-full-scan/tools/extract-scope.mjs', 'utf8')
const out = src.replace(
  "const OUT = join(dirname(fileURLToPath(import.meta.url)), '..') // artifacts/eote-full-scan",
  "const OUT = join(dirname(fileURLToPath(import.meta.url)), '..') // games/arkhamhorror/docs/edgeOfTheEarth/eote-scan",
)
writeFileSync('games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/tools/extract-scope.mjs', out, 'utf8')
console.log('copied ok', out.length)
