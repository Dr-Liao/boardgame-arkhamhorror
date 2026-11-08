import fs from 'node:fs'
let src = fs.readFileSync('build-findings.mjs', 'utf8')
src = src.replace("      scopeJson: `${REF}/../arkham-api/...` ,\n", "")
src = src.replace('补地�点揭示测试', '补地点揭示测试')
fs.writeFileSync('build-findings.mjs', src, 'utf8')
