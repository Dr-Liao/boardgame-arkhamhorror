import fs from 'node:fs'
const d = JSON.parse(fs.readFileSync('G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/b/data.json', 'utf8'))
const codes = new Set(d.scope.codes)
for (const c of d.screen.tests.cards) {
  if (!codes.has(c.code)) continue
  console.log(c.code, c.level, 'files=' + JSON.stringify(c.files), 'strong=' + JSON.stringify(c.strongTitles), 'weak=' + JSON.stringify(c.weakTitles), 'asserts=' + c.fileAssertCount)
}
