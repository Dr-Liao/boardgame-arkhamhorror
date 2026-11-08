import fs from 'node:fs'
const txt = fs.readFileSync('G:/boardgame-hall-ai/games/arkhamhorror/src/cards/cards-data.js','utf8')
for (const code of ['08609','08608','08641','08642','08643','08607','08630','08634','08637','08640']) {
  const idx = txt.indexOf('"' + code + '"')
  console.log('=== ' + code + ' @' + idx)
  console.log(txt.slice(idx, idx + 1000).split('\n').slice(0, 28).join('\n'))
}
