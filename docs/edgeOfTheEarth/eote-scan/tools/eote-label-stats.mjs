import { readFileSync } from 'node:fs'
const MODS = 'G:/boardgame-hall-ai/games/arkhamhorror'
const SCAN = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan'
const cards = JSON.parse(readFileSync(`${SCAN}/scope/cards.json`, 'utf8')).cards
const cjk = /[\u4e00-\u9fff]/
const rows = []
for (const c of cards) {
  if (!c.entryPath) continue
  const src = readFileSync(`${MODS}/${c.entryPath}`, 'utf8').replace(/^\/\/.*$/gm, '')
  const labels = [...src.matchAll(/label\s*:\s*['"`]([^'"`]+)['"`]/g)].map(m => m[1])
  const prompts = [...src.matchAll(/prompt\s*:\s*['"`]([^'"`]+)['"`]/g)].map(m => m[1])
  const info = [...src.matchAll(/api\.info(?:To)?\s*\(\s*['"`]([^'"`]+)['"`]/g)].map(m => m[1])
  if (labels.length || prompts.length) rows.push({
    code: c.code, name: c.nameZh || c.name, type: c.type, partition: c.partition,
    labels: labels.length, cjkLabels: labels.filter(x => cjk.test(x)).length,
    prompts: prompts.length, cjkPrompts: prompts.filter(x => cjk.test(x)).length,
    infos: info.length, cjkInfos: info.filter(x => cjk.test(x)).length,
    sampleLabel: labels.find(x => cjk.test(x))?.slice(0, 90) || null,
    samplePrompt: prompts.find(x => cjk.test(x))?.slice(0, 90) || null,
    entry: c.entryPath,
  })
}
const summary = {
  cardsWithDynamicText: rows.length,
  labels: rows.reduce((n, r) => n + r.labels, 0),
  cjkLabels: rows.reduce((n, r) => n + r.cjkLabels, 0),
  prompts: rows.reduce((n, r) => n + r.prompts, 0),
  cjkPrompts: rows.reduce((n, r) => n + r.cjkPrompts, 0),
  infos: rows.reduce((n, r) => n + r.infos, 0),
  cjkInfos: rows.reduce((n, r) => n + r.cjkInfos, 0),
  filesWithCjkLabel: rows.filter(r => r.cjkLabels > 0).length,
  filesWithCjkPrompt: rows.filter(r => r.cjkPrompts > 0).length,
}
console.log(JSON.stringify({ summary, samples: rows.filter(r => r.cjkLabels > 0 || r.cjkPrompts > 0).slice(0, 12) }, null, 1))
