import fs from 'node:fs'
const src = fs.readFileSync('G:/boardgame-hall-ai/games/arkhamhorror/src/cards/cards-data.js','utf8')
// line 140-142 likely: export const ALL_CARDS = { ... } ; grab up to 200 chars
const start = src.indexOf('export const ALL_CARDS')
console.log(src.slice(start, start + 300))
