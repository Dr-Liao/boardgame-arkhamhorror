import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { contentRegistry } from '../content/registered.js'
import { chapters, CHAOS_BAGS, recordTypes } from '../content/campaigns/theForgottenAge/shared.js'
import { assertMigrationConfirmations } from '../content/migration-confirmation.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { canSelectInvestigator } from '../src/deck/availability.js'
import { INVESTIGATOR_CODES } from '../content/packs/tfaInvestigators/manifest.js'
import { IMPLEMENTED_PLAYER_CODES } from '../content/packs/tfaPlayer/manifest.js'
import { TFA_KEYWORDS, TFA_RULE_IDS } from '../content/campaigns/theForgottenAge/keywords.js'
import { RULES, RULE_INDEX, cardRuleIds } from '../web/rulebook-data.js'

const sourceRoot = new URL('../../../参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham/', import.meta.url)
const storySourceRoot = new URL('../../../参考资源/ArkhamHorror-main/frontend/src/locales/zh/theForgottenAge/', import.meta.url)

// Return To products and their exclusive encounter sets live in the same
// directories as the original cycle; keep them out of the locked source set.
const RETURN_TO_SETS = /CultOfPnakotus|VenomousHate|TemporalHunters|DoomedExpedition/

async function sourceInventory(url = sourceRoot, prefix = '') {
  const entries = await readdir(url, { withFileTypes: true })
  const result = []
  for (const entry of entries) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) result.push(...await sourceInventory(new URL(`${entry.name}/`, url), path))
    else if (entry.isFile() && path.endsWith('.hs') && path.includes('TheForgottenAge')
      && !path.includes('ReturnTo') && !RETURN_TO_SETS.test(path)) result.push(path)
  }
  return result
}

const packageLockedPaths = [
  'Campaign/Campaigns/TheForgottenAge.hs',
  'Campaigns/TheForgottenAge/ChaosBag.hs',
  'Campaigns/TheForgottenAge/CampaignSteps.hs',
  'Campaigns/TheForgottenAge/Key.hs',
  'Campaigns/TheForgottenAge/Supply.hs',
  'Campaigns/TheForgottenAge/Meta.hs',
]
const sources = [...new Set([...packageLockedPaths, ...await sourceInventory()])].sort()
const sourceHashes = await Promise.all(sources.map(async path => ({
  path,
  sha256: createHash('sha256').update(await readFile(new URL(path, sourceRoot))).digest('hex'),
})))

const storySources = ['base.json', ...chapters.map(chapter => `scenarios/${chapter.id}.json`)]
const storySourceHashes = await Promise.all(storySources.map(async path => ({
  path,
  sha256: createHash('sha256').update(await readFile(new URL(path, storySourceRoot))).digest('hex'),
})))

const packIds = ['tfaCampaign', 'tfaInvestigators', 'tfaPlayer']
const packs = packIds.map(id => {
  const pack = contentRegistry.getPack(id)
  if (!pack) throw new Error(`缺少卡包 ${id}`)
  return pack
})
const packedCodes = packs.flatMap(pack => pack.cards.map(card => card.code))
const duplicated = packedCodes.filter((code, index) => packedCodes.indexOf(code) !== index)
if (duplicated.length) throw new Error(`卡包分区重复：${[...new Set(duplicated)].join(', ')}`)

const mainCodes = Object.keys(ALL_CARDS).filter(code => /^04\d{3}$/.test(code)).sort()
const linkedFaces = Object.keys(ALL_CARDS).filter(code => /^04\d{3}[a-z]$/.test(code)).sort()
const unassigned = mainCodes.filter(code => !packedCodes.includes(code))
if (unassigned.length) throw new Error(`未分区的 04 循环卡：${unassigned.join(', ')}`)
const foreign = packedCodes.filter(code => !mainCodes.includes(code))
if (foreign.length) throw new Error(`卡包登记了非 04 循环卡：${foreign.join(', ')}`)

// 章节验收账本由 tools/audit-tfa-scenarios.mjs 生成；这里只做汇总，避免两份事实来源。
const ledger = JSON.parse(await readFile(new URL('../audit/tfa-scenario-acceptance.json', import.meta.url), 'utf8'))
if (ledger.items.length !== chapters.length) throw new Error('章节验收账本条目数与章节清单不一致')

const chapterItems = []
for (const chapter of chapters) {
  const module = await import(`../content/campaigns/theForgottenAge/scenarios/${chapter.id}/index.js`)
  const registered = contentRegistry.getScenario(chapter.id)
  const entry = ledger.items.find(item => item.id === chapter.id)
  if (!registered || registered.campaignId !== 'theForgottenAge') throw new Error(`未注册章节 ${chapter.id}`)
  if ((registered.referenceCode || module.scenario.originalCode) !== chapter.code) {
    throw new Error(`${chapter.id} 的原卡号与来源不一致`)
  }
  if (!ALL_CARDS[chapter.code]) throw new Error(`${chapter.id} 的原卡 ${chapter.code} 不在目录中`)
  if (module.manifest.id !== chapter.id || module.behavior.id !== chapter.id) throw new Error(`${chapter.id} 模块身份不一致`)
  if (!['playable', 'verified'].includes(registered.status)) {
    throw new Error(`${chapter.id} 已进入发布阶段，状态必须是 playable 或 verified`)
  }
  if (!entry) throw new Error(`章节验收账本缺少 ${chapter.id}`)
  chapterItems.push({
    id: chapter.id,
    code: chapter.code,
    name: chapter.name,
    status: entry.status,
    checks: entry.checks,
    evidence: [
      `参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham/Scenario/Scenarios/TheForgottenAge/${chapter.sourceName}.hs`,
      `games/arkhamhorror/content/campaigns/theForgottenAge/scenarios/${chapter.id}/definition.js`,
      `games/arkhamhorror/content/campaigns/theForgottenAge/scenarios/${chapter.id}/behavior.js`,
      `games/arkhamhorror/content/campaigns/theForgottenAge/story-text.js`,
      `games/arkhamhorror/${entry.testFile}`,
    ],
    gaps: entry.gaps,
    pendingEncounterCodes: entry.inventory.pendingEncounterCodes,
  })
}

const campaign = contentRegistry.getCampaign('theForgottenAge')
let launchable = true
try { contentRegistry.assertLaunchable('theForgottenAge') } catch { launchable = false }
// M5：入口开放。此后这里必须持续成立，任何回退都要显式改回不可启动并说明原因。
if (!launchable) throw new Error('失落的时代战役在大厅已开放，不能再变成不可启动')
if (campaign.status !== 'playable') throw new Error('战役状态必须是 playable')
if (packs[0].status !== 'playable') throw new Error('战役内容包必须是 playable')
if (packs[1].status !== 'playable') throw new Error('调查员包必须已逐人验收并开放（playable）')
if (packs[2].status !== 'playable') throw new Error('玩家卡包必须已逐卡验收并开放（playable）')
if (packs[1].cards.filter(card => !card.rulesImplemented).length) throw new Error('调查员包仍有未实现卡牌')
for (const card of packs[2].cards) {
  if (!card.rulesImplemented) continue
  if (!IMPLEMENTED_PLAYER_CODES.includes(card.code)) throw new Error(`玩家卡 ${card.code} 未登记在已实现清单`)
}
const unimplementedPlayerCards = packs[2].cards.filter(card => !card.rulesImplemented).map(card => card.code)
if (unimplementedPlayerCards.length) {
  throw new Error(`玩家卡包仍有未实现卡牌：${unimplementedPlayerCards.join(', ')}`)
}
if (IMPLEMENTED_PLAYER_CODES.length !== packs[2].cards.length) {
  throw new Error(`已实现清单 ${IMPLEMENTED_PLAYER_CODES.length} 张与包内 ${packs[2].cards.length} 张不一致`)
}
const selectableInvestigators = INVESTIGATOR_CODES.filter(code => canSelectInvestigator(code))
if (selectableInvestigators.length !== INVESTIGATOR_CODES.length) throw new Error('失落的时代调查员尚未全部可选')

// ---------------------------------------------------------------------------
// M4：关键词与规则书。每一项都由可复核的事实推导，不手写 verified。
// ---------------------------------------------------------------------------
const rulesById = new Map(RULES.map(rule => [rule.id, rule]))
const ruleIndexIds = new Set(RULE_INDEX.map(rule => rule.id))
const keywordTestSource = await readFile(new URL('../tests/tfa-rules.test.mjs', import.meta.url), 'utf8')
const browserTestSource = await readFile(new URL('../tests/tfa-rules.browser.mjs', import.meta.url), 'utf8')
// 浏览器验收以专用用例为证据：截图落在被 gitignore 的根 artifacts/，不参与 --check，
// 否则干净检出会因为缺少本地截图而误报漂移（与二循环口径一致）。
const browserCovered = viewport => browserTestSource.includes('M4')
  && browserTestSource.includes(`'${viewport}'`) && browserTestSource.includes('tfaCampaign')
const textOf = card => `${card?.text || ''}\n${card?.textZh || ''}`
const engineModules = new Map()
const exported = async (modulePath, name) => {
  if (!engineModules.has(modulePath)) engineModules.set(modulePath, await import(`../${modulePath}`))
  return typeof engineModules.get(modulePath)[name] === 'function'
}

const keywordItems = []
for (const keyword of TFA_KEYWORDS) {
  const pattern = new RegExp(keyword.pattern, 'i')
  const sourceInventoried = keyword.cardCodes.length > 0 && keyword.cardCodes.every(code =>
    ALL_CARDS[code] && pattern.test(textOf(ALL_CARDS[code])))
  const engineBehavior = (await Promise.all(keyword.engine.names.map(name =>
    exported(keyword.engine.module, name)))).every(Boolean)
  const rule = rulesById.get(keyword.ruleId)
  const rulebookEntry = Boolean(rule) && rule.group === '失落的时代' && ruleIndexIds.has(keyword.ruleId)
    && rule.aliases.some(alias => alias.toLowerCase().includes(keyword.zh) || keyword.zh.includes(alias))
    && rule.body.join('').length > 80
  const cardLinks = keyword.cardCodes.every(code => cardRuleIds(ALL_CARDS[code]).includes(keyword.ruleId))
  const nodeAcceptance = keywordTestSource.includes(`'${keyword.id}'`)
    && keywordTestSource.includes('TFA_KEYWORDS')
  const checks = { sourceInventoried, engineBehavior, nodeAcceptance, rulebookEntry, cardLinks }
  keywordItems.push({
    id: keyword.id,
    printed: keyword.printed,
    zh: keyword.zh,
    ruleId: keyword.ruleId,
    cardCodes: [...keyword.cardCodes],
    status: Object.values(checks).every(Boolean) ? 'verified' : 'pending',
    checks,
    evidence: [
      'games/arkhamhorror/tests/tfa-rules.test.mjs',
      'games/arkhamhorror/web/rulebook-data.js',
      `games/arkhamhorror/${keyword.engine.module}#${keyword.engine.names.join(',')}`,
      ...keyword.cardCodes.map(code => `games/arkhamhorror/src/cards/cards-data.js#${code}`),
    ],
  })
}

// 规则书卡牌直达：每个失落的时代章节卡都要能跳到战役与混乱符号条目。
const chapterRuleLinks = []
for (const chapter of chapters) {
  const module = await import(`../content/campaigns/theForgottenAge/scenarios/${chapter.id}/index.js`)
  const codes = [module.scenario.originalCode,
    ...module.scenario.acts.map(card => card.originalCode),
    ...module.scenario.agendas.map(card => card.originalCode)]
  for (const code of codes.filter(entry => /^04\d{3}[a-z]?$/.test(entry))) {
    const ids = cardRuleIds(ALL_CARDS[code])
    if (!ids.includes('tfaCampaign') || !ids.includes('tfaChaos')) {
      chapterRuleLinks.push(`${chapter.id}/${code}`)
    }
  }
}
const rulebookChecks = {
  campaignOverview: ['tfaCampaign', 'tfaExploration', 'tfaSupplies', 'tfaVengeance', 'tfaPoison', 'tfaRelic',
    'tfaTimeline', 'tfaDescent', 'tfaChaos'].every(id => rulesById.has(id))
    && /战役记录|记录/.test(rulesById.get('tfaCampaign').body.join('')),
  scenarioMechanics: ['tfaExploration', 'tfaSupplies', 'tfaVengeance', 'tfaTimeline', 'tfaDescent', 'tfaChaos']
    .every(id => (rulesById.get(id)?.body.join('').length || 0) > 150),
  keywordEntries: TFA_KEYWORDS.every(keyword => keywordItems.find(item => item.id === keyword.id)?.checks.rulebookEntry),
  cardLinks: chapterRuleLinks.length === 0
    && TFA_KEYWORDS.every(keyword => keywordItems.find(item => item.id === keyword.id)?.checks.cardLinks),
  desktopBrowser: browserCovered('desktop'),
  mobileBrowser: browserCovered('mobile'),
}

// remaining 由账本计算，不再写死：浏览器证据与 literalCardBehavior 都从逐章 checks 汇总，
// 避免出现「checks 全 true 但 remaining 仍写 false」的自相矛盾。
const pendingLiteral = ledger.items.filter(item => !item.checks.literalCardBehavior)
const pendingBrowser = ledger.items.filter(item => !item.checks.browserAcceptance)
const remaining = [
  ...ledger.items.flatMap(item => [
    ...(item.inventory.pendingEncounterCodes.length
      ? [`${item.id}：遭遇卡 ${item.inventory.pendingEncounterCodes.join('、')} 仍按共享规则/待办处理`] : []),
    ...item.gaps.map(gap => `${item.id}：${gap}`),
  ]),
  ...(pendingLiteral.length
    ? [`逐章 literalCardBehavior 未完成：${pendingLiteral.map(item => item.id).join('、')}（按规范 5.2 保持 false）`]
    : []),
  ...(pendingBrowser.length
    ? [`章节浏览器验收未完成：${pendingBrowser.map(item => item.id).join('、')}`]
    : [`章节浏览器验收：${ledger.items.length} 章 checks 全真，但 audit/tfa-browser-acceptance.json 为手工提交、无 runner 生成器（TCU 审计必须由 runner 生成）`]),
  '发布验收：大厅、联机与浏览器端到端发布验收（earlyAccess 期间不宣称规则等价）',
]

const report = {
  schemaVersion: 1,
  milestone: 'M5',
  campaignId: 'theForgottenAge',
  status: campaign.status,
  playable: true,
  launchEnabled: true,
  earlyAccess: true,
  equivalenceCertified: false,
  verifiedScope: 'M0 目录基线、M1 五名调查员与 11 张专属卡、M2 91 张玩家卡、M3-A 七项循环机制、'
    + 'M3-B 十个剧本的布置/幕议/地点/遭遇/混乱标记/结局与跨章记录、M3-C 完整剧情导入与座位级过滤、'
    + 'M4 八个关键词（explore/vengeance/yigsFury/supplies/poisoned/relicOfAges/expeditionLeader/elderThing）'
    + '与九条规则书条目、拼音索引、卡文直达及桌面/移动端浏览器验收、'
    + 'M5 入口开放（十个剧本 playable、战役可启动、序幕补给品购买与幕间划补给）。'
    + 'literalCardBehavior 与章节浏览器验收仍未完成，因此按 earlyAccess 记录，不宣称规则等价。',
  playerCards: {
    status: packs[2].status,
    verified: IMPLEMENTED_PLAYER_CODES.length,
    total: packs[2].cards.length,
    evidence: 'games/arkhamhorror/tests/tfa-player-acceptance.test.mjs',
    verifiedCodes: [...IMPLEMENTED_PLAYER_CODES],
  },
  mechanics: {
    status: 'verified',
    items: [
      'tfaExploration', 'tfaSupplies', 'tfaVengeance', 'tfaYigsFury',
      'tfaPoisoned', 'tfaRelicOfAges', 'tfaExpeditionLeader',
    ].map(id => ({ id, status: 'verified', evidence: 'games/arkhamhorror/tests/tfa-mechanics.test.mjs' })),
  },
  scenarios: {
    status: ledger.status,
    evidence: 'games/arkhamhorror/audit/tfa-scenario-acceptance.json',
    items: ledger.items.map(item => ({
      id: item.id,
      status: item.status,
      locations: item.inventory.locations,
      acts: item.inventory.acts,
      agendas: item.inventory.agendas,
      enemies: item.inventory.enemies,
      treacheries: item.inventory.treacheries,
      resolutions: item.inventory.resolutions,
      fileHashes: item.fileHashes,
    })),
  },
  story: {
    status: 'verified',
    generator: 'games/arkhamhorror/tools/import-tfa-story.mjs',
    evidence: ['games/arkhamhorror/content/campaigns/theForgottenAge/story-text.js',
      'games/arkhamhorror/tests/tfa-story.test.mjs'],
  },
  catalog: {
    printedRecords: mainCodes.length + linkedFaces.length,
    mainCodes: mainCodes.length,
    linkedFaces: linkedFaces.length,
    campaign: packs[0].cards.length,
    investigatorsAndSignatures: packs[1].cards.length,
    playerCards: packs[2].cards.length,
    selectableInvestigators: selectableInvestigators.length,
    verifiedInvestigatorCards: packs[1].cards.filter(card => card.rulesImplemented).length,
  },
  chapters: chapters.map(chapter => ({
    id: chapter.id,
    code: chapter.code,
    name: chapter.name,
    pack: chapter.packCodes,
    status: contentRegistry.getScenario(chapter.id).status,
    catalogReferenceOnly: false,
  })),
  chaosBags: Object.fromEntries(Object.entries(CHAOS_BAGS).map(([difficulty, tokens]) => [difficulty, {
    tokens: tokens.length,
    symbols: [...new Set(tokens.filter(token => /^[a-z]/.test(token)))].sort(),
  }])),
  recordSchema: Object.fromEntries(Object.entries(recordTypes).map(([key, type]) => [key, type])),
  sourceRoot: '参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham',
  sources: sourceHashes,
  resources: {
    cardCatalog: 'games/arkhamhorror/src/cards/cards-data.js (04xxx)',
    storySourceRoot: '参考资源/ArkhamHorror-main/frontend/src/locales/zh/theForgottenAge',
    storySources: storySourceHashes,
    localImageRoot: 'games/arkhamhorror/web/img',
    imagePaths: ['cards/<code>.avif', 'zh/cards/<code>.avif'],
    imagePolicy: '与核心包、一循环和二循环共用卡图解析、离线库存与远程回退；不建立循环专属图片目录。',
    presentation: '缺少 web/img/campaigns/theForgottenAge 与音频资源，M5 发布前必须补齐或按缺失登记。',
  },
  confirmations: {
    scenarios: {
      status: ledger.status,
      items: chapterItems,
    },
    keywords: {
      status: keywordItems.every(item => item.status === 'verified') ? 'verified' : 'pending',
      items: keywordItems,
    },
    rulebook: {
      status: Object.values(rulebookChecks).every(Boolean) ? 'verified' : 'pending',
      requiredRuleIds: [...TFA_RULE_IDS],
      checks: rulebookChecks,
      evidence: [
        'games/arkhamhorror/web/rulebook-data.js',
        'games/arkhamhorror/tests/tfa-rules.test.mjs',
        'games/arkhamhorror/tests/tfa-rules.browser.mjs',
      ],
    },
  },
  tests: [
    'games/arkhamhorror/tests/tfa-migration.test.mjs', 'games/arkhamhorror/tests/tfa-investigators.test.mjs',
    'games/arkhamhorror/tests/tfa-mechanics.test.mjs', 'games/arkhamhorror/tests/tfa-player-acceptance.test.mjs',
    'games/arkhamhorror/tests/tfa-scenario-acceptance.test.mjs', 'games/arkhamhorror/tests/tfa-story.test.mjs',
    'games/arkhamhorror/tests/tfa-rules.test.mjs', 'games/arkhamhorror/tests/tfa-rules.browser.mjs',
    ...ledger.items.map(item => `games/arkhamhorror/${item.testFile}`),
  ],
  remaining,
}
assertMigrationConfirmations(report, chapters.map(chapter => chapter.id))

const target = new URL('../audit/tfa-migration.json', import.meta.url)
const serialized = JSON.stringify(report, null, 2) + '\n'
const mode = process.argv[2]
if (mode === '--write') await writeFile(target, serialized)
else if (mode === '--check') {
  if (await readFile(target, 'utf8') !== serialized) {
    throw new Error('失落的时代迁移清单或参考来源已漂移，请审阅后更新')
  }
} else if (mode) throw new Error('使用 --write 或 --check')
else console.log(serialized)

if (mode) {
  console.log(`M5: ${mainCodes.length} main codes = ${packs[0].cards.length} campaign + ${packs[1].cards.length} investigator + ${packs[2].cards.length} player; `
    + `${linkedFaces.length} linked faces; selectable investigators=${selectableInvestigators.length}; `
    + `verified player cards=${IMPLEMENTED_PLAYER_CODES.length}; chapters=${ledger.items.length}; `
    + `keywords=${keywordItems.filter(item => item.status === 'verified').length}/${keywordItems.length}; `
    + `rulebook=${report.confirmations.rulebook.status}; campaign launchable=${launchable}`)
}
