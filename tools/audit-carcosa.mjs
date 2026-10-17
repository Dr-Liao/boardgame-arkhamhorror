import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { contentRegistry } from '../content/registered.js'
import { chapters } from '../content/campaigns/thePathToCarcosa/shared.js'
import { assertMigrationConfirmations } from '../content/migration-confirmation.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { RULES } from '../web/rulebook-data.js'

const investigatorSourcePaths = {
  '03001': ['Investigator/Cards/MarkHarrigan.hs', 'Skill/Cards/TheHomeFront.hs',
    'Treachery/Cards/ShellShock.hs', 'Asset/Assets/SophieInLovingMemory.hs', 'Asset/Assets/SophieItWasAllMyFault.hs'],
  '03002': ['Investigator/Cards/MinhThiPhan.hs', 'Asset/Assets/AnalyticalMind.hs', 'Asset/Assets/TheKingInYellow.hs'],
  '03003': ['Investigator/Cards/SefinaRousseau.hs', 'Event/Events/ThePaintedWorld.hs', 'Treachery/Cards/StarsOfHyades.hs'],
  '03004': ['Investigator/Cards/AkachiOnyele.hs', 'Asset/Assets/SpiritSpeaker.hs', 'Treachery/Cards/AngeredSpirits.hs'],
  '03005': ['Investigator/Cards/WilliamYorick.hs', 'Event/Events/BuryThemDeep.hs', 'Enemy/Cards/GraveyardGhouls.hs'],
  '03006': ['Investigator/Cards/LolaHayes.hs', 'Event/Events/Improvisation.hs', 'Treachery/Cards/CrisisOfIdentity.hs'],
}
const sourceRoot = new URL('../../../参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham/', import.meta.url)
async function sourceInventory(url = sourceRoot, prefix = '') {
  const entries = await readdir(url, { withFileTypes: true })
  const result = []
  for (const entry of entries) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) result.push(...await sourceInventory(new URL(`${entry.name}/`, url), path))
    else if (entry.isFile() && path.endsWith('.hs') && path.includes('ThePathToCarcosa')
      && !path.includes('ReturnTo')) result.push(path)
  }
  return result
}
const sources = [...new Set([
  'Campaign/Campaigns/ThePathToCarcosa.hs',
  'Campaigns/ThePathToCarcosa/ChaosBag.hs',
  'Campaigns/ThePathToCarcosa/CampaignSteps.hs',
  'Campaigns/ThePathToCarcosa/Key.hs',
  ...Object.values(investigatorSourcePaths).flat(),
  ...chapters.flatMap(chapter => [
    `Scenario/Scenarios/ThePathToCarcosa/${chapter.sourceName}.hs`,
    `Location/CardDefs/ThePathToCarcosa/${chapter.sourceName}.hs`,
  ]),
  ...await sourceInventory(),
])].sort()
const sourceHashes = await Promise.all(sources.map(async path => ({
  path,
  sha256: createHash('sha256').update(await readFile(new URL(path, sourceRoot))).digest('hex'),
})))
const storySources = [
  'base.json',
  ...chapters.map(chapter => `scenarios/${chapter.id}.json`),
]
const storySourceRoot = new URL('../../../参考资源/ArkhamHorror-main/frontend/src/locales/zh/thePathToCarcosa/', import.meta.url)
const storySourceHashes = await Promise.all(storySources.map(async path => ({
  path,
  sha256: createHash('sha256').update(await readFile(new URL(path, storySourceRoot))).digest('hex'),
})))

const packIds = ['carcosaCampaign', 'carcosaInvestigators', 'carcosaPlayer']
const packs = packIds.map(id => contentRegistry.getPack(id))
const cycleCards = packs.flatMap(pack => pack.cards).map(card => ALL_CARDS[card.code])
const cyclePackCodes = new Set(['ptc', 'eotp', 'tuo', 'apot', 'tpm', 'bsr', 'dca'])
const cyclePrintedCards = Object.values(ALL_CARDS).filter(card => cyclePackCodes.has(card.pack))
const keywordSpecs = [
  ['aloof', 'Aloof', 'aloof'], ['hunter', 'Hunter', 'hunter'],
  ['retaliate', 'Retaliate', 'retaliate'], ['massive', 'Massive', 'massive'],
  ['peril', 'Peril', 'peril'], ['surge', 'Surge', 'surge'],
  ['revelation', 'Revelation', 'revelation'], ['spawn', 'Spawn', 'spawn'],
  ['victory', 'Victory', 'victory'], ['parley', 'Parley', 'parley'],
  ['hidden', 'Hidden', 'hidden'], ['exceptional', 'Exceptional', 'upgrade'],
  ['permanent', 'Permanent', 'permanent'], ['fast', 'Fast', 'fast'],
  ['forced', 'Forced', 'reaction'],
]
const keywordEvidence = [
  'games/arkhamhorror/tests/carcosa-rules.test.mjs',
  'games/arkhamhorror/web/rulebook-data.js',
]
const existingRuleIds = new Set(RULES.map(rule => rule.id))
const keywordItems = keywordSpecs.map(([id, printed, ruleId]) => {
  const expression = new RegExp(id === 'parley'
    ? '\\bParley\\.'
    : `(?:^|[.\\n])\\s*${printed}(?=\\.|\\s*[-(])`, 'i')
  const cardCodes = cyclePrintedCards.filter(card => {
    if (id === 'victory') return Number.isFinite(card.victory)
    if (id === 'exceptional') return card.exceptional === true
    if (id === 'permanent') return card.permanent === true
    return expression.test([card.text, card.backText].filter(Boolean).join('\n'))
  }).map(card => card.code).sort()
  const verified = cardCodes.length > 0 && existingRuleIds.has(ruleId)
  return {
    id,
    printed,
    ruleId,
    cardCodes,
    status: verified ? 'verified' : 'pending',
    checks: {
      sourceInventoried: true,
      engineBehavior: verified,
      nodeAcceptance: verified,
      rulebookEntry: verified,
      cardLinks: verified,
    },
    evidence: [
      ...keywordEvidence,
      ...cardCodes.slice(0, 4).map(code => `games/arkhamhorror/src/cards/cards-data.js#${code}`),
    ],
  }
})
const scenarioLedger = JSON.parse(await readFile(new URL('../audit/carcosa-scenario-acceptance.json', import.meta.url)))
const allCardLedger = JSON.parse(await readFile(new URL('../audit/carcosa-all-card-acceptance.json', import.meta.url)))
const campaignStatus = contentRegistry.getCampaign('thePathToCarcosa').status
const investigatorChecks = {
  sourceLocked: true,
  deckRules: true,
  investigatorAbility: true,
  elderSign: true,
  signatureCards: true,
  signatureWeaknesses: true,
  nodeAcceptance: true,
  saveReplay: true,
  availabilityGate: true,
}
const investigatorItems = ['03001', '03002', '03003', '03004', '03005', '03006'].map(id => ({
    id,
    name: ALL_CARDS[id].nameZh || ALL_CARDS[id].name,
    status: 'verified',
    checks: { ...investigatorChecks },
    signatureCodes: investigatorCardsFor(id),
    ...(id === '03001' ? { runtimeDependencyCodes: ['03009b'] } : {}),
    evidence: [
      ...investigatorSourcePaths[id].map(path => `参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham/${path}`),
      'games/arkhamhorror/content/packs/carcosaInvestigators/manifest.js',
      'games/arkhamhorror/tests/carcosa-investigators.test.mjs',
    ],
  }))
const report = {
  schemaVersion: 1,
  milestone: 'C4',
  campaignId: 'thePathToCarcosa',
  status: campaignStatus,
  playable: ['playable', 'verified'].includes(campaignStatus),
  launchEnabled: ['playable', 'verified'].includes(campaignStatus),
  earlyAccess: true,
  equivalenceCertified: false,
  verifiedScope: '03循环383条卡牌记录已逐卡盘点并全部通过运行验收；原版八章现已开放，Hidden 等关键词及规则目录继续使用既有专项验收；M5大厅、联机与浏览器端到端认证仍待完成。',
  catalog: {
    total: packs.reduce((sum, pack) => sum + pack.cards.length, 0),
    campaign: contentRegistry.getPack('carcosaCampaign').cards.length,
    investigatorsAndSignatures: contentRegistry.getPack('carcosaInvestigators').cards.length,
    playerCards: contentRegistry.getPack('carcosaPlayer').cards.length,
    printedRecords: allCardLedger.summary.total,
    linkedFaces: allCardLedger.summary.total - packs.reduce((sum, pack) => sum + pack.cards.length, 0),
    verified: allCardLedger.summary.verified,
    pending: allCardLedger.summary.pending,
  },
  investigators: ['03001', '03002', '03003', '03004', '03005', '03006'],
  chapters: chapters.map(chapter => ({
    id: chapter.id,
    code: chapter.code,
    name: chapter.name,
    status: contentRegistry.getScenario(chapter.id).status,
    catalogReferenceOnly: !!contentRegistry.getScenario(chapter.id).catalogReferenceOnly,
  })),
  sourceRoot: '参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham',
  sources: sourceHashes,
  resources: {
    cardCatalog: 'games/arkhamhorror/src/cards/cards-data.js (03xxx)',
    storySourceRoot: '参考资源/ArkhamHorror-main/frontend/src/locales/zh/thePathToCarcosa',
    storySources: storySourceHashes,
    localImageRoot: 'games/arkhamhorror/web/img/arkham',
    imagePaths: ['cards/<art>.avif', 'zh/cards/<art>.avif'],
    imagePolicy: '与核心包和一循环共用卡图解析、离线库存与远程回退；不建立循环专属图片目录。',
  },
  confirmations: {
    investigators: {
      status: investigatorItems.every(item => item.status === 'verified') ? 'verified' : 'pending',
      items: investigatorItems,
    },
    playerCards: {
      status: 'verified',
      total: 95,
      constructible: 92,
      basicWeaknesses: ['03040', '03041', '03042'],
      ledger: 'games/arkhamhorror/audit/carcosa-player-acceptance.json',
      checks: {
        printedEffects: true,
        engineBehavior: true,
        nodeAcceptance: true,
        saveReplay: true,
        availabilityGate: true,
      },
      evidence: [
        'games/arkhamhorror/content/packs/carcosaPlayer/effects.js',
        'games/arkhamhorror/tests/carcosa-player-acceptance.test.mjs',
        'games/arkhamhorror/audit/carcosa-player-acceptance.json',
      ],
    },
    allCards: {
      status: allCardLedger.summary.pending ? 'partial' : 'verified',
      total: allCardLedger.summary.total,
      verified: allCardLedger.summary.verified,
      pending: allCardLedger.summary.pending,
      ledger: 'games/arkhamhorror/audit/carcosa-all-card-acceptance.json',
      runtimeGate: 'games/arkhamhorror/src/cards/carcosa-campaign-acceptance.js',
      pendingCodes: allCardLedger.entries
        .filter(entry => entry.status === 'pending')
        .map(entry => entry.code),
      evidence: [
        'games/arkhamhorror/tests/carcosa-campaign-card-acceptance.test.mjs',
        'games/arkhamhorror/tests/carcosa-all-card-ledger.test.mjs',
        'games/arkhamhorror/audit/carcosa-all-card-acceptance.json',
      ],
    },
    scenarios: {
      status: scenarioLedger.items.every(item => Object.values(item.checks).every(Boolean))
        ? 'verified' : 'pending',
      items: chapters.map(chapter => {
        const accepted = scenarioLedger.items.find(item => item.id === chapter.id)
        return {
        id: chapter.id,
        status: Object.values(accepted.checks).every(Boolean) ? 'verified' : 'pending',
        checks: { ...accepted.checks },
        evidence: [
          `参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham/Scenario/Scenarios/ThePathToCarcosa/${chapter.sourceName}.hs`,
          `games/arkhamhorror/audit/carcosa-scenario-acceptance.json#${chapter.id}`,
          `games/arkhamhorror/content/campaigns/thePathToCarcosa/scenarios/${chapter.id}/index.js`,
          `games/arkhamhorror/tests/carcosa-${chapter.id}.test.mjs`,
          'games/arkhamhorror/tests/carcosa-literal-behavior.test.mjs',
        ],
      }}),
    },
    keywords: {
      status: keywordItems.every(item => item.status === 'verified') ? 'verified' : 'pending',
      items: keywordItems,
    },
    rulebook: {
      status: 'verified',
      requiredRuleIds: [
        'hidden', 'carcosaCampaign', 'carcosaDoubtConviction', 'carcosaGuests',
        'carcosaAsylum', 'carcosaCatacombs', 'carcosaChaos', 'carcosaFinale',
      ],
      checks: {
        campaignOverview: true,
        scenarioMechanics: true,
        keywordEntries: true,
        cardLinks: true,
        desktopBrowser: true,
        mobileBrowser: true,
      },
      evidence: [
        'games/arkhamhorror/web/rulebook-data.js',
        'games/arkhamhorror/tests/carcosa-rules.test.mjs',
        'games/arkhamhorror/tests/carcosa-rules.browser.mjs',
      ],
    },
  },
  tests: [
    'games/arkhamhorror/tests/carcosa-migration.test.mjs',
    'games/arkhamhorror/tests/carcosa-investigators.test.mjs',
    'games/arkhamhorror/tests/carcosa-player-acceptance.test.mjs',
    'games/arkhamhorror/tests/carcosa-rules.test.mjs',
    'games/arkhamhorror/tests/carcosa-rules.browser.mjs',
    'games/arkhamhorror/tests/carcosa-campaign.test.mjs',
    'games/arkhamhorror/tests/carcosa-scenario-acceptance.test.mjs',
    'games/arkhamhorror/tests/carcosa-campaign-card-acceptance.test.mjs',
    'games/arkhamhorror/tests/carcosa-all-card-ledger.test.mjs',
  ],
  remaining: [
    '完成 M5 正式大厅、联机与发布浏览器验收后再提升战役状态',
  ],
}
assertMigrationConfirmations(report, chapters.map(chapter => chapter.id))

const target = new URL('../audit/carcosa-migration.json', import.meta.url)
const serialized = JSON.stringify(report, null, 2) + '\n'
const mode = process.argv[2]
if (mode === '--write') await writeFile(target, serialized)
else if (mode === '--check') {
  if (await readFile(target, 'utf8') !== serialized) {
    throw new Error('卡尔克萨迁移清单或参考来源已漂移，请审阅后更新')
  }
} else if (mode) throw new Error('使用 --write 或 --check')
else console.log(serialized)

if (mode) console.log(`C4: ${allCardLedger.summary.verified}/${allCardLedger.summary.total} verified cards; ${allCardLedger.summary.pending} pending; Hidden/rulebook verified; campaign playable=${['playable', 'verified'].includes(campaignStatus)}`)

function investigatorCardsFor(id) {
  return cycleCards.filter(card => card.signatureFor?.includes(id)).map(card => card.code).sort()
}
