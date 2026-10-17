import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import {
  carcosaInvestigatorCardVerified,
  CARCOSA_INVESTIGATOR_ACCEPTANCE_PROFILE,
} from '../content/packs/carcosaInvestigators/manifest.js'
import {
  carcosaPlayerCardVerified,
  CARCOSA_PLAYER_ACCEPTANCE_PROFILE,
} from '../src/cards/carcosa-player-acceptance.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const game = 'games/arkhamhorror'
const cyclePacks = new Set(['ptc', 'eotp', 'tuo', 'apot', 'tpm', 'bsr', 'dca'])
const files = [
  `${game}/tests/carcosa-investigators.test.mjs`,
  `${game}/tests/carcosa-player-acceptance.test.mjs`,
  `${game}/tests/carcosa-campaign-card-acceptance.test.mjs`,
  `${game}/tests/carcosa-literal-behavior.test.mjs`,
  `${game}/tests/carcosa-pending-encounters.test.mjs`,
]
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const home = path.join(root, 'artifacts/carcosa-all-cards/audit-home')
fs.mkdirSync(home, { recursive: true })

const run = spawnSync(process.execPath, [
  '--test',
  `--test-reporter=./${game}/tools/core-test-reporter.mjs`,
  ...files,
], {
  cwd: root,
  env: { ...process.env, DSH_HOME: home },
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
const results = run.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
fs.writeFileSync(
  path.join(root, 'artifacts/carcosa-all-cards/acceptance-results.json'),
  `${JSON.stringify(results, null, 2)}\n`,
)
if (run.status !== 0 || !results.length || results.some(result =>
  result.type !== 'test:pass' || result.skipped || result.todo)) {
  console.error(results.filter(result =>
    result.type !== 'test:pass' || result.skipped || result.todo), run.stderr)
  process.exit(1)
}

const cards = Object.values(ALL_CARDS)
  .filter(card => cyclePacks.has(card.pack))
  .sort((left, right) => left.code.localeCompare(right.code))
if (cards.length !== 383) throw new Error(`Unexpected Carcosa scope: ${cards.length}`)

const campaignResults = results.filter(result =>
  /^Carcosa \w+ (已验收|待实现) ·/.test(result.name))
const campaignByCode = new Map(campaignResults.map(result => {
  const [, code, label] = result.name.match(/^Carcosa (\w+) (已验收|待实现) ·/)
  return [code, { ...result, status: label === '已验收' ? 'verified' : 'pending' }]
}))
if (campaignByCode.size !== 268) throw new Error(`Unexpected campaign acceptance scope: ${campaignByCode.size}`)

const entries = cards.map(card => {
  let partition
  let status
  let evidence
  if (carcosaInvestigatorCardVerified(card.code)) {
    partition = 'investigator'
    status = 'verified'
    evidence = [{
      file: `${game}/tests/carcosa-investigators.test.mjs`,
      test: `C1 调查员、专属卡与弱点验收（${CARCOSA_INVESTIGATOR_ACCEPTANCE_PROFILE.id}）`,
    }]
  } else if (carcosaPlayerCardVerified(card.code)) {
    partition = 'player'
    status = 'verified'
    const result = results.find(candidate => candidate.name.startsWith(`Carcosa ${card.code} `))
    if (!result) throw new Error(`No player-card evidence: ${card.code}`)
    evidence = [{ file: path.relative(root, result.file).replaceAll('\\', '/'), test: result.name }]
  } else {
    partition = 'campaign'
    const result = campaignByCode.get(card.code)
    if (!result) throw new Error(`No campaign-card assessment: ${card.code}`)
    status = result.status
    evidence = [{ file: path.relative(root, result.file).replaceAll('\\', '/'), test: result.name }]
  }
  return {
    code: card.code,
    name: card.nameZh || card.name,
    type: card.type,
    pack: card.pack,
    partition,
    status,
    evidence,
  }
})

const profile = {
  id: 'original-carcosa-cycle-all-cards-2026-10',
  scope: '卡尔克萨之路原始循环七个卡包共383条目录记录，包含20条调查员及专属记录、95张玩家卡和268条战役卡面。',
  basis: '逐卡运行测试、严格卡面字面行为测试、既有C1/C2验收账本、八章确定性布置与存档回放，以及M4 Hidden专项规则验证；只有具备运行证据的卡标记已验收。',
  pendingPolicy: '仅登记卡文、目录、章节归属、rulesPending或源码卡号引用不构成通过；缺少完整费用、时机、目标、区位、分支或离场路径的卡保持待实现。',
  availability: '战役与战役卡包继续保持 catalog-only，逐卡标记不开放生产战役。',
  inheritedProfiles: [
    CARCOSA_INVESTIGATOR_ACCEPTANCE_PROFILE.id,
    CARCOSA_PLAYER_ACCEPTANCE_PROFILE.id,
  ],
  sources: [
    '参考资源/ArkhamHorror-main/frontend/public/cards_en.json',
    '参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham',
  ],
}
const verifiedEntries = entries.filter(entry => entry.status === 'verified')
const pendingEntries = entries.filter(entry => entry.status === 'pending')
const ledger = {
  schemaVersion: 1,
  profile,
  summary: {
    total: entries.length,
    verified: verifiedEntries.length,
    pending: pendingEntries.length,
    investigator: entries.filter(entry => entry.partition === 'investigator').length,
    player: entries.filter(entry => entry.partition === 'player').length,
    campaign: entries.filter(entry => entry.partition === 'campaign').length,
    testsPassed: results.length,
  },
  testFiles: files.map(file => ({
    file,
    sha256: hash(fs.readFileSync(path.join(root, file))),
  })),
  entries,
}
if (ledger.summary.verified !== 383 || ledger.summary.pending !== 0) {
  throw new Error(`Unexpected status totals: ${JSON.stringify(ledger.summary)}`)
}

const json = `${JSON.stringify(ledger, null, 2)}\n`
const campaignVerified = verifiedEntries
  .filter(entry => entry.partition === 'campaign')
  .map(entry => entry.code)
const campaignPending = pendingEntries.map(entry => entry.code)
const module = `// Generated by tools/audit-carcosa-all-cards.mjs after executing C1-C4 acceptance tests.
// Detailed evidence: audit/carcosa-all-card-acceptance.json.
export const CARCOSA_CAMPAIGN_ACCEPTANCE_PROFILE = ${JSON.stringify(profile, null, 2)}
export const CARCOSA_ALL_CARD_ACCEPTANCE_SHA256 = '${hash(json)}'
const verified = new Set(${JSON.stringify(campaignVerified)})
const pending = new Set(${JSON.stringify(campaignPending)})
export const carcosaCampaignCardVerified = code => verified.has(code)
export const carcosaCampaignCardPending = code => pending.has(code)
`
for (const [file, text] of [
  ['audit/carcosa-all-card-acceptance.json', json],
  ['src/cards/carcosa-campaign-acceptance.js', module],
]) {
  const destination = path.join(root, game, file)
  if (process.argv.includes('--write')) fs.writeFileSync(destination, text)
  else if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== text) {
    throw new Error(`Acceptance artifact stale: ${file}`)
  }
}
console.log(JSON.stringify(ledger.summary))
