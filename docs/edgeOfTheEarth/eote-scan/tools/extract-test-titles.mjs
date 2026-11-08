import { readFileSync } from 'node:fs'
const MODS = 'G:/boardgame-hall-ai/games/arkhamhorror/'
const files = ['tests/eote-p8-campaign.test.mjs', 'tests/eote-campaign-flow.test.mjs', 'tests/eote-p8-multiplayer.test.mjs', 'tests/eote-p8-registration.test.mjs', 'tests/replay-eote-p8.test.mjs', 'tests/eote-scenario-theHeartOfMadnessPart2.test.mjs']
const out = {}
for (const f of files) {
  const t = readFileSync(`${MODS}${f}`, 'utf8')
  const titles = [...t.matchAll(/(?:^|\n)\s*test\(\s*'(?:[^'\\]|\\.)*'|(?:^|\n)\s*test\(\s*"([^"]+)"|(?:^|\n)\s*test\(\s*`([^`]+)`/g)].map(m => m[1] || m[2])
  const titles2 = [...t.matchAll(/test\(\s*['"`]([^'"`]+)['"`]/g)].map(m => m[1])
  out[f] = { count: titles2.length, titles: titles2 }
}
console.log(JSON.stringify(out, null, 1))
