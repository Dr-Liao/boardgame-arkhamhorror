import fs from 'node:fs'
const p = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/d/_work/gen-findings.mjs'
let t = fs.readFileSync(p, 'utf8')
const old = "for (const code of ['08695', '08696', '08697']) {\n  setCard(code, 'match', ["
const neu = "for (const code of ['08695', '08696', '08697']) {\n  setCard(code, 'gap', ["
if (!t.includes(old)) throw new Error('anchor missing')
t = t.replace(old, neu)
fs.writeFileSync(p, t, 'utf8')
console.log('patched verdicts')
