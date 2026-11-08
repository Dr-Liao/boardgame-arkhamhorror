import fs from 'node:fs'
const ROOT = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan'
const codes = ['08587', '08588', '08589', '08590', '08591', '08592', '08593', '08594', '08595']
const out = []
for (const code of codes) {
  const raw = fs.readFileSync(`${ROOT}/bundles/${code}.md`, 'utf8')
  const parts = raw.split(/^## /m)
  const out1 = { en: '', backEn: '', entry: '', tests: '' }
  for (const part of parts.slice(1)) {
    const nl = part.indexOf('\n'); const name = part.slice(0, nl).trim(); const body = part.slice(nl + 1)
    const m = body.match(/```(?:js|json)?\n([\s\S]*?)```/); const content = m ? m[1] : body
    if (name.includes('英文')) { if (name.includes('背面')) out1.backEn = content.trim(); else out1.en = content.trim() }
    else if (name.includes('条目源码')) out1.entry = content.trim()
    else if (name.includes('相关测试')) out1.tests = content.trim()
  }
  out.push(`===== ${code} ${parts[0].split('\n')[0].replace(/^# /, '')}\n--- EN ---\n${out1.en}\n${out1.backEn ? '--- BACK ---\n' + out1.backEn + '\n' : ''}--- ENTRY ---\n${out1.entry}\n--- TESTS ---\n${out1.tests}\n`)
}
fs.writeFileSync(`${ROOT}/campaign/d/_work/digest-resolute.md`, out.join('\n'), 'utf8')
console.log('bytes', out.join('\n').length)
