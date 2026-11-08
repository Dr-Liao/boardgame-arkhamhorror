import fs from 'node:fs'
const ROOT = 'G:/boardgame-hall-ai/games/arkhamhorror/src/cards/encounter-entries/edgeOfTheEarth'
for (const code of ['08614','08615','08616','08617','08618','08619','08620','08622','08623','08624','08630','08631','08632','08634','08637','08640','08641','08642','08643','08646','08647']) {
  for (const dir of ['toTheForbiddenPeaks','cityOfTheElderThings']) {
    const p = `${ROOT}/${dir}/${code}.js`
    if (!fs.existsSync(p)) continue
    const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/)
    const hits = []
    lines.forEach((l, i) => { const m = l.match(/(uses|usesType|flags|enemyRule|locationRule|agendaRule|actRule|treacheryRule|onReveal|forcedOnEnemyEnter|keyActions|actTwoActions|actions|objective|blocksClueDiscovery|doubleKeyTokenModifier|frostForced\w+|blocksKeysWhileReady|takesKeyOnEngage|readiesOnKeyControlled|placesKeyOnLeave|onDefeatDoom|onSpawnDoom|spawn|parley|threatArea)\s*[:=]/); if (m) hits.push((i + 1) + ':' + m[1]) })
    console.log(dir, code, 'lines=' + lines.length, hits.join(' '))
  }
}
