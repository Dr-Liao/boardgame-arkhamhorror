import fs from 'node:fs'
const dir = 'G:/boardgame-hall-ai/games/arkhamhorror/src/cards/encounter-entries/edgeOfTheEarth/fatalMirage/'
for (const c of ['08550', '08556', '08557', '08558', '08559', '08560', '08561', '08562', '08566', '08567', '08571', '08572', '08574', '08575', '08576', '08579', '08575b', '08584', '08585', '08586', '08587', '08588', '08590', '08553']) {
  const s = fs.readFileSync(dir + c + '.js', 'utf8')
  const lines = s.split(/\r?\n/)
  const hits = lines.map((l, i) => `${i + 1}:${l.trim()}`)
    .filter(x => /agendaRule|actRule|enemyRule|treacheryRule|abilities|flags:|mirageId|tier|forced|reaction|investigatorShroudBonus|extraInvestigateCost|moveCost|freeFrost|storyFlip/.test(x))
  console.log(c, 'lines', lines.length - 1, '::', hits.join(' | '))
}
