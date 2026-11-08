import fs from 'node:fs'
const s = JSON.parse(fs.readFileSync('G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/screen/flags-readpoints.json', 'utf8'))
for (const key of ['storyFlip', 'mirageId', 'storyFace', 'tier', 'startLocation']) {
  const unread = (s.unread || []).filter(row => JSON.stringify(row).includes(key))
  console.log('KEY', key, 'unread', unread.length)
  for (const row of unread.slice(0, 5)) console.log('   ', JSON.stringify(row))
}
const all = (s.all || []).filter(row => JSON.stringify(row).includes('storyFlip'))
console.log('all storyFlip:', all.length)
for (const row of all.slice(0, 6)) console.log('   ', JSON.stringify(row))
