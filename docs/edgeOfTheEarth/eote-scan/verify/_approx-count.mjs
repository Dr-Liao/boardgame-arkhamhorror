import { readFileSync, existsSync } from 'node:fs'
const MOD = 'G:/boardgame-hall-ai/games/arkhamhorror'
const codes = []
for (let n = 8019; n <= 8133; n++) codes.push(String(n).padStart(5, '0'))
const stats = { total: 0, noteApprox: [], commentApprox: [], anyApproxWord: [], simplifiedFlag: [], noFile: [] }
for (const code of codes) {
  const path = `${MOD}/src/cards/entries/${code}.js`
  if (!existsSync(path)) { stats.noFile.push(code); continue }
  stats.total++
  const text = readFileSync(path, 'utf8')
  const noteLines = text.split(/\r?\n/).map((l, i) => ({ l, i: i + 1 })).filter(x => /note\s*:/.test(x.l))
  if (noteLines.some(x => /approximation/i.test(x.l))) stats.noteApprox.push(code)
  if (/\/\/.*approximation/i.test(text)) stats.commentApprox.push(code)
  if (/approximation|近似|省略|简化|未实现|缺失/.test(text)) stats.anyApproxWord.push(code)
  if (/simplified\s*:\s*true/.test(text)) stats.simplifiedFlag.push(code)
}
console.log(JSON.stringify({
  total: stats.total, noFile: stats.noFile,
  noteApprox: stats.noteApprox.length, noteApproxCodes: stats.noteApprox,
  commentApprox: stats.commentApprox.length, commentApproxCodes: stats.commentApprox,
  anyApproxWord: stats.anyApproxWord.length,
  simplifiedFlag: stats.simplifiedFlag,
}, null, 1))
