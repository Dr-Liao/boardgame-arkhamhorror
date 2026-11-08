import fs from 'node:fs'
const text = fs.readFileSync('src/cards/cards-data.js', 'utf8')
const idx = [...text.matchAll(/memorial/gi)].map(m => m.index)
console.log('cards-data memorial count', idx.length)
for (const i of idx.slice(0, 20)) console.log(JSON.stringify(text.slice(i - 150, i + 120)))
