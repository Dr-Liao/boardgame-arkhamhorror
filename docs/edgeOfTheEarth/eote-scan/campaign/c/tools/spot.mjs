import fs from 'node:fs'
const show = (p, a, b) => { const L = fs.readFileSync(p,'utf8').split(/\r?\n/); for (let i=a;i<=b;i++) console.log(i + '| ' + L[i-1]) }
console.log('=== city behavior 455-490')
show('G:/boardgame-hall-ai/games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/behavior.js', 455, 490)
console.log('=== 08607 entry 10-22')
show('G:/boardgame-hall-ai/games/arkhamhorror/src/cards/encounter-entries/edgeOfTheEarth/toTheForbiddenPeaks/08607.js', 10, 22)
console.log('=== city definition 140-200')
show('G:/boardgame-hall-ai/games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/definition.js', 140, 200)
console.log('=== interludes 48-56')
show('G:/boardgame-hall-ai/games/arkhamhorror/content/campaigns/edgeOfTheEarth/interludes.js', 48, 56)
