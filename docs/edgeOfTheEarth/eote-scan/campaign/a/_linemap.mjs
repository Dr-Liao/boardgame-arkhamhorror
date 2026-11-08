// scratch map (auditor A) — entry file line numbers for key declarations
import fs from 'node:fs'
const root = 'G:/boardgame-hall-ai/games/arkhamhorror/src/cards/encounter-entries/edgeOfTheEarth/'
const codes = '08501 08502 08503 08504 08505 08506 08507 08508 08509 08510 08511 08512 08513 08514 08515 08516 08517 08518 08519 08520 08521 08522 08523 08524 08525 08526 08527 08528 08529 08530 08531 08532 08533 08534 08535 08536 08537 08538 08539 08540 08541 08542 08543 08544 08545 08546 08547 08548'.split(' ')
const dirs = ['_shared/ice_and_death', 'iceAndDeathPart1', 'iceAndDeathPart2', 'iceAndDeathPart3']
const keys = ['export default', 'flags:', 'abilities:', 'encounterResolve', 'agendaRule:', 'actRule:', 'enemyScript:', 'enemyRule:', 'treacheryRule:', 'locationRule:', 'note:', 'code:']
const out = []
for (const code of codes) {
  let file = null
  for (const d of dirs) { const p = root + d + '/' + code + '.js'; if (fs.existsSync(p)) { file = p; break } }
  if (!file) { out.push(code + '\tMISSING'); continue }
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  const hits = []
  lines.forEach((line, i) => { for (const k of keys) if (line.includes(k)) hits.push(`${k.replace(':','')}@${i + 1}`) })
  out.push(code + '\t' + file.replace(root, '') + '\t' + hits.join(' '))
}
fs.writeFileSync('G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/a/_entry_lines.txt', out.join('\n'))
console.log(out.join('\n'))
