import { readFileSync } from 'node:fs'
const lines = readFileSync('G:/boardgame-hall-ai/games/arkhamhorror/audit/eote-player-acceptance.json', 'utf8').split(/\r?\n/)
const codes = ['08086', '08097', '08104', '08112', '08113', '08117', '08120', '08124', '08130', '08133']
for (const code of codes) {
  const i = lines.findIndex(l => l.includes(`"code": "${code}"`))
  let status = null; let simp = null; let ev = null
  for (let k = i; k < i + 40; k++) {
    if (/"status":/.test(lines[k])) status = `${k + 1}: ${lines[k].trim()}`
    if (/"simplified":/.test(lines[k])) simp = `${k + 1}: ${lines[k].trim()}`
    if (!ev && /"evidence":/.test(lines[k])) ev = k + 1
  }
  console.log(code, 'entryLine', i + 1, '|', status, '|', simp, '| evidenceLine', ev)
}
