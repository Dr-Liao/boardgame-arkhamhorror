// 统计 EOTE 八章「章节专用诡计」是否声明了引擎真实的结算入口：
// 引擎 encounters 路径：entry.encounterResolve / entry.treacheryRule.test / t.effect(.kind)，
// 否则静默无效果（treachery-tokens.js:113-137）。
import fs from 'node:fs'
import path from 'node:path'

const root = 'G:/boardgame-hall-ai/games/arkhamhorror/src/cards/encounter-entries/edgeOfTheEarth'
const CHAPTERS = ['iceAndDeathPart1', 'iceAndDeathPart2', 'iceAndDeathPart3', 'fatalMirage',
  'toTheForbiddenPeaks', 'cityOfTheElderThings', 'theHeartOfMadnessPart1', 'theHeartOfMadnessPart2']
const out = {}
for (const chapter of CHAPTERS) {
  const dir = path.join(root, chapter)
  if (!fs.existsSync(dir)) continue
  const rows = []
  for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.js'))) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8')
    if (!/scope:\s*'treachery'|scope:\s*"treachery"/.test(text)) continue
    rows.push({
      code: file.replace('.js', ''),
      encounterResolve: /^\s{2}encounterResolve\s*[:(]/m.test(text),
      treacheryTest: /treacheryRule:\s*\{[\s\S]*?\btest\s*[:(]/.test(text),
      ruleKeys: (text.match(/treacheryRule:\s*\{([^}]*)\}/s)?.[1] || '').trim().replace(/\s+/g, ' ').slice(0, 160),
      flags: (text.match(/flags:\s*\{([^}]*)\}/s)?.[1] || '').trim().replace(/\s+/g, ' ').slice(0, 120),
    })
  }
  out[chapter] = rows
}
console.log(JSON.stringify(out, null, 1))
