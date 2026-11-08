import fs from 'node:fs'
const txt = fs.readFileSync('G:/boardgame-hall-ai/games/arkhamhorror/src/cards/cards-data.js','utf8')
const data = JSON.parse(txt.slice(txt.indexOf('{', txt.indexOf('ALL_CARDS') >= 0 ? 0 : 0)))
