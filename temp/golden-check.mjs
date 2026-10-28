import fs from 'node:fs'
const d = JSON.parse(fs.readFileSync('tests/fixtures/replay/golden-replays.json', 'utf8'))
const raw = JSON.stringify(d)
for (const k of ['killed', 'insane', 'replacement', 'hubPurchase', 'hubDoneSeat', 'hubUpgrade']) {
  console.log(k, (raw.match(new RegExp(`"${k}"`, 'g')) || []).length)
}
