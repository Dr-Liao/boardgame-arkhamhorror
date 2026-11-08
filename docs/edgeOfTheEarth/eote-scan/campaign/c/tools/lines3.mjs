import fs from 'node:fs'
const ROOT = 'G:/boardgame-hall-ai/games/arkhamhorror/src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks'
for (const code of ['08614','08615','08616','08617','08618','08619','08620']) {
  const lines = fs.readFileSync(`${ROOT}/${code}.js`, 'utf8').split(/\r?\n/)
  console.log('=== ' + code + ' lines=' + lines.length)
  lines.forEach((l, i) => console.log((i + 1) + '| ' + l))
}
