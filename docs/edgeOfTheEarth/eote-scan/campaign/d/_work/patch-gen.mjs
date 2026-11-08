import fs from 'node:fs'
const p = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/d/_work/gen-findings.mjs'
let t = fs.readFileSync(p, 'utf8')
const reps = [
  ["${entryFile('08651')}:${24}", "${entryFile('08651')}:46"],
  ["${entryFile('08652')}:${24}", "${entryFile('08652')}:46"],
  ["${entryFile('08654')}:${20}", "${entryFile('08654')}:37"],
  ["${entryFile('08689')}:22-31", "${entryFile('08689')}:17-25"],
  ["${entryFile('08719')}:44-45", "${entryFile('08719')}:30-31"],
  ["${entryFile('08727')}:16-17", "${entryFile('08727')}:17-18"],
  ["${entryFile('08738')}:14-34", "${entryFile('08738')}:12-34"],
]
for (const [a, b] of reps) {
  if (!t.includes(a)) console.log('MISS', a)
  t = t.split(a).join(b)
}
fs.writeFileSync(p, t, 'utf8')
console.log('patched')
