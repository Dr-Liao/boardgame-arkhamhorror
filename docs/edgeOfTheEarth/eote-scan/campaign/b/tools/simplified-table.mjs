import fs from 'node:fs'
const d = JSON.parse(fs.readFileSync('G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/b/findings.json', 'utf8'))
const simplified = d.deviations?.simplified || []
const rows = []
for (const card of d.cards.filter(card => card.ledgerStatus === 'simplified')) {
  const plannedStatus = card.issues.some(issue => issue.severity === 'high') ? '实际缺失（high）' : '近似（medium）'
  rows.push(`| ${card.code} | ${card.nameZh} | ${card.simplifiedReason} | 无 p7-${card.code}.json 请求文件 | ${plannedStatus} | ${card.issues[0]?.evidence || ''} |`)
}
console.log(rows.join('\n'))
