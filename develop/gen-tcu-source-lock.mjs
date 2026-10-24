// 生成 audit/tcu-scenario-source-lock.json：P8 九章剧本参考实现文件哈希锁。
// 只读 参考资源/ArkhamHorror-main（若不存在则保留旧锁），产物是 Git 跟踪的审计锁。
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { CAMPAIGN_ID } from '../content/campaigns/theCircleUndone/shared.js'

const REFERENCE_ROOT = 'G:/boardgame-hall-ai/参考资源/ArkhamHorror-main'
const HASK = `${REFERENCE_ROOT}/backend/arkham-api/library/Arkham`
const OUT = 'G:/boardgame-hall-ai/games/arkhamhorror/audit/tcu-scenario-source-lock.json'

const CAMPAIGN_FILES = [
  'Campaigns/TheCircleUndone/Key.hs',
  'Campaigns/TheCircleUndone/ChaosBag.hs',
  'Campaigns/TheCircleUndone/Memento.hs',
  'Campaigns/TheCircleUndone/CampaignSteps.hs',
  'Campaigns/TheCircleUndone/Helpers.hs',
  'Tarot.hs',
  'Helpers/Tarot.hs',
]

const CHAPTERS = [
  ['disappearanceAtTheTwilightEstate', 'DisappearanceAtTheTwilightEstate'],
  ['theWitchingHour', 'TheWitchingHour'],
  ['atDeathsDoorstep', 'AtDeathsDoorstep'],
  ['theSecretName', 'TheSecretName'],
  ['theWagesOfSin', 'TheWagesOfSin'],
  ['forTheGreaterGood', 'ForTheGreaterGood'],
  ['unionAndDisillusion', 'UnionAndDisillusion'],
  ['inTheClutchesOfChaos', 'InTheClutchesOfChaos'],
  ['beforeTheBlackThrone', 'BeforeTheBlackThrone'],
]

const hashFile = async relative => {
  const full = `${HASK}/${relative}`
  if (!existsSync(full)) return null
  const bytes = await readFile(full)
  return { path: `backend/arkham-api/library/Arkham/${relative}`, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length }
}

const shared = []
for (const relative of CAMPAIGN_FILES) {
  const entry = await hashFile(relative)
  if (entry) shared.push(entry)
}
const chapters = {}
for (const [id, pascal] of CHAPTERS) {
  const files = []
  for (const relative of [
    `Scenario/Scenarios/TheCircleUndone/${pascal}.hs`,
    `Location/CardDefs/TheCircleUndone/${pascal}.hs`,
  ]) {
    const entry = await hashFile(relative)
    if (entry) files.push(entry)
  }
  chapters[id] = files
}
const lock = {
  schemaVersion: 1,
  cycle: 'tcu',
  campaignId: CAMPAIGN_ID,
  generatedBy: 'develop/gen-tcu-source-lock.mjs',
  referenceRoot: '参考资源/ArkhamHorror-main',
  shared,
  chapters,
}
await writeFile(OUT, JSON.stringify(lock, null, 2) + '\n')
console.log('shared', shared.length, 'chapters', Object.keys(chapters).length,
  'files', Object.values(chapters).reduce((sum, files) => sum + files.length, 0))
for (const [id, files] of Object.entries(chapters)) console.log(id, files.length)
