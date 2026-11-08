// 汇总本分片测试覆盖 + 条目行号证据。
import fs from 'node:fs'
const ROOT = 'G:/boardgame-hall-ai'
const tc = JSON.parse(fs.readFileSync(`${ROOT}/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/screen/tests-coverage.json`, 'utf8'))
const inScope = code => /^08(59[6-9]|6[0-4][0-9])$/.test(String(code))
const rows = []
for (const c of tc.cards.filter(c => inScope(c.code))) {
  rows.push({
    code: c.code, level: c.level,
    strongCount: (c.strongTitles || []).length,
    strong: (c.strongTitles || []).slice(0, 3).map(t => `${t.file}:${t.line} ${t.title}`),
    weakCount: (c.weakTitles || []).length,
    fileCount: (c.files || []).length,
  })
}
fs.writeFileSync(`${ROOT}/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/c/_tests-summary.json`, JSON.stringify(rows, null, 1), 'utf8')
console.log(JSON.stringify(rows, null, 1))
