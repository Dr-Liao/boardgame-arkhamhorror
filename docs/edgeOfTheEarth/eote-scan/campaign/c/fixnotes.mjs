import fs from 'node:fs'
let src = fs.readFileSync('notes.md', 'utf8')
src = src.split('${P}').join('content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks')
src = src.split('${C}').join('content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings')
src = src.split('${REF}').join('参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham')
fs.writeFileSync('notes.md', src, 'utf8')
console.log('patched notes')
