#!/usr/bin/env node
// 万象无终（TCU）迁移账本：把「内容注册表 + M0 范围账本 + 关键词/规则书事实源 + 测试与浏览器证据」合成一份可复算的审计。
//
//   node tools/audit-tcu.mjs --write    重写 audit/tcu-migration.json
//   node tools/audit-tcu.mjs --check    复算并逐字节比对（内容、判据或证据变化即失败）
//
// 证据规则（路线图 §8.3，从 TFA 的坏账吸取）：
// - **一个事实源**：关键词来自 content/campaigns/theCircleUndone/keywords.js，规则条目来自 web/rulebook-data.js，
//   卡面来自 src/cards/cards-data.js，章节来自 content/campaigns/theCircleUndone/shared.js；
//   本工具不读「已冻结的结论 JSON」再复制，`--check` 能独立重算。
// - **Node 验收实跑**：spawnSync 执行 tests/tcu-rules.test.mjs 并读退出码，不用 testSource.includes(...) 字符串匹配。
// - **浏览器证据由 runner 生成**：只读 audit/tcu-browser-acceptance.json（tests/tcu-rules.browser.mjs 的 reporter 产物）；
//   文件缺失或未通过时 desktopBrowser/mobileBrowser 一律为 false，不手工补。
// - **remaining 由计算得出**：从 checks 为 false 的项、未 verified 的关键词、未完成原语与章节/卡牌状态汇总。

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { contentRegistry } from '../content/registered.js'
import { CAMPAIGN_CARD_CODES } from '../content/packs/tcuCampaign/manifest.js'
import {
  INVESTIGATOR_CARD_CODES, TCU_INVESTIGATOR_CODES as PACK_INVESTIGATOR_CODES,
  TCU_SIGNATURE_CODES, tcuInvestigatorCardVerified,
} from '../content/packs/tcuInvestigators/manifest.js'
import {
  PLAYER_CARD_CODES,
  TCU_PLAYER_BASIC_WEAKNESS_CODES, TCU_PLAYER_BUILDABLE_CODES,
} from '../content/packs/tcuPlayer/manifest.js'
import {
  CHAOS_BAGS, ENCOUNTER_GROUP_IDS, INVESTIGATOR_CODES, STORY_INVESTIGATOR_CODES,
  chapters, recordTypes,
} from '../content/campaigns/theCircleUndone/shared.js'
import { TCU_KEYWORDS, TCU_RULE_IDS, TCU_SCANNED_KEYWORD_MECHANISMS } from '../content/campaigns/theCircleUndone/keywords.js'
import { supportedMechanics } from '../content/mechanics.js'
import { RULES, RULE_INDEX, cardRuleIds } from '../web/rulebook-data.js'
import { UI_CARDS } from '../web/ui-cards.js'
import { campaignListForUi } from '../content/registry.js'
import { deckBuilderData } from '../src/deck/deckbuilding.js'
import { corePlayerPool } from '../src/engine/engine.js'
import { campaignPresentation } from '../web/campaign-presentation.js'
import { MUSIC_TRACKS, MUSIC_PLAYLISTS } from '../web/music-player.js'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { investigatorRule } from '../src/cards/card-rules.js'
// 能力层注册表在 engine.js 首次加载时才装配；账本要读条目，因此显式触发装配
// （与 tools/audit-abilities.mjs 同一口径，不依赖调用顺序）。
import { registerCardAbilities, registeredCodes, registeredEntry } from '../src/engine/ability.js'
import { CARD_ABILITY_ENTRIES } from '../src/cards/card-abilities.js'
import { NON_PLAYER_ABILITY_ENTRIES } from '../src/cards/encounter-abilities.js'
// 能力层注册表在 engine.js 首次加载时才装配；账本要读条目，因此显式装配（幂等）。
if (!registeredCodes().length) registerCardAbilities([...CARD_ABILITY_ENTRIES, ...NON_PLAYER_ABILITY_ENTRIES])
import { canSelectInvestigator, getAvailability, SIGNATURES_BY_INVESTIGATOR } from '../src/deck/availability.js'
import { buildDeck } from '../src/deck/deckbuilding.js'
import { normalizeHunchDeckRule } from '../src/engine/hunch-deck.js'
import { normalizeResourceBankRule } from '../src/engine/resource-bank.js'
import { validateCampaignGraph } from '../src/campaign/campaign-flow.js'

const CAMPAIGN_ID = 'theCircleUndone'
const PACK_IDS = ['tcuCampaign', 'tcuInvestigators', 'tcuPlayer']
const SCOPE_PATH = 'artifacts/migration/tcu/scope.json'
const PRIMITIVE_CATALOG_PATH = 'artifacts/migration/tcu/primitive-catalog.json'
const MECHANISM_SCAN_PATH = 'artifacts/migration/tcu/mechanism-scan.json'
const BROWSER_PATH = 'audit/tcu-browser-acceptance.json'
const KEYWORDS_PATH = 'content/campaigns/theCircleUndone/keywords.js'
const RULEBOOK_PATH = 'web/rulebook-data.js'
const UI_CARDS_PATH = 'web/ui-cards.js'
const MECHANICS_PATH = 'content/mechanics.js'
const RULES_TEST_PATH = 'tests/tcu-rules.test.mjs'
const BROWSER_SPEC_PATH = 'tests/tcu-rules.browser.mjs'
// 第 5 步（P6）：M1 调查员的 Node 验收。
const INVESTIGATOR_TEST_PATH = 'tests/tcu-investigators.test.mjs'
const INVESTIGATOR_PACK_PATH = 'content/packs/tcuInvestigators/manifest.js'
const INVESTIGATOR_HELPERS = [
  'src/engine/hunch-deck.js', 'src/engine/resource-bank.js', 'src/engine/spell-actions.js',
  'src/engine/cancel-note.js',
]
// 第 5 步（P7）：M2 玩家卡逐卡验收（工具实跑 4 个分片测试并生成账本与运行时模块）。
const PLAYER_PACK_PATH = 'content/packs/tcuPlayer/manifest.js'
const PLAYER_TEST_FILES = [
  'tests/tcu-player-m2-1.test.mjs',
  'tests/tcu-player-m2-2.test.mjs',
  'tests/tcu-player-m2-3.test.mjs',
  'tests/tcu-player-m2-4.test.mjs',
]
const PLAYER_LEDGER_TEST_PATH = 'tests/tcu-player-ledger.test.mjs'
const PLAYER_ACCEPTANCE_TOOL_PATH = 'tools/audit-tcu-player.mjs'
const PLAYER_ACCEPTANCE_LEDGER_PATH = 'audit/tcu-player-acceptance.json'
const PLAYER_ACCEPTANCE_MODULE_PATH = 'src/cards/tcu-player-acceptance.js'
const AVAILABILITY_PATH = 'src/deck/availability.js'
const CAMPAIGN_PATH = 'src/campaign/campaign.js'
// 第 5 步（P8）：9 章剧本的逐章账本、验收工具、来源锁与实机浏览器用例。
const SCENARIO_ACCEPTANCE_TOOL_PATH = 'tools/audit-tcu-scenarios.mjs'
const SCENARIO_ACCEPTANCE_LEDGER_PATH = 'audit/tcu-scenario-acceptance.json'
const SCENARIO_LEDGER_TEST_PATH = 'tests/tcu-scenario-acceptance.test.mjs'
const SCENARIO_SOURCE_LOCK_PATH = 'audit/tcu-scenario-source-lock.json'
const SCENARIO_BROWSER_SPEC_PATH = 'tests/tcu-scenarios.browser.mjs'
// 第 5 步（P9）：M3-C 剧情——生成器产物、幕间与战役流程、运行时/通用效果、私密正文投影。
const STORY_TOOL_PATH = 'tools/import-tcu-story.mjs'
const STORY_TEXT_PATH = 'content/campaigns/theCircleUndone/story-text.js'
const STORY_TEST_PATH = 'tests/tcu-story.test.mjs'
const INTERLUDES_PATH = 'content/campaigns/theCircleUndone/interludes.js'
const CAMPAIGN_MANIFEST_PATH = 'content/campaigns/theCircleUndone/manifest.js'
const STORY_ENGINE_PATH = 'src/campaign/story.js'
const STORY_EFFECTS_PATH = 'src/campaign/campaign-effects.js'
const CAMPAIGN_VIEW_PATH = 'src/campaign/campaign.js'
// 第 4 步（P5）：交互面板的 Node 验收与浏览器用例。
const INTERACTIONS_TEST_PATH = 'tests/tcu-interactions.test.mjs'
const INTERACTIONS_SPEC_PATH = 'tests/tcu-interactions.browser.mjs'
const INTERACTIONS_UI_PATH = 'web/tcu-ui.js'
const INTERACTIONS_CSS_PATH = 'web/tcu-panels.css'
// 第 6 步（P10）：M5 发布——逐卡账本、发布级实机浏览器证据、展示素材、开放玩家池。
const ALL_CARDS_TOOL_PATH = 'tools/audit-tcu-all-cards.mjs'
const ALL_CARDS_LEDGER_PATH = 'audit/tcu-all-card-acceptance.json'
const ALL_CARDS_MODULE_PATH = 'src/cards/tcu-campaign-acceptance.js'
const ALL_CARDS_TEST_PATH = 'tests/tcu-all-card-ledger.test.mjs'
const CARD_FIDELITY_TEST_PATH = 'tests/tcu-campaign-card-acceptance.test.mjs'
const CARD_NOTES_PATH = 'content/campaigns/theCircleUndone/card-acceptance.js'
// P10：逐卡行为审计（印刷描述 vs 实现）的证据账本；逐卡结论由 AI 逐批核对后汇总入库，
// 每张卡的自动测试证据仍在 allCards 账本里，两者不互相替代。
const CARD_BEHAVIOR_LEDGER_PATH = 'audit/tcu-card-behavior-audit.json'
const RELEASE_SPEC_PATH = 'tests/tcu-release.browser.mjs'
const MEDIA_SPEC_PATH = 'tests/tcu-media.browser.mjs'
const PRESENTATION_PATH = 'web/campaign-presentation.js'
const MUSIC_PLAYER_PATH = 'web/music-player.js'
const MUSIC_PLAYLIST_PATH = 'web/scenario-music.js'
const MUSIC_SOURCES_PATH = 'web/audio/music/sources.json'
const TCU_IMAGE_DIR = 'web/img/campaigns/theCircleUndone/'
const TARGET = new URL('../audit/tcu-migration.json', import.meta.url)
const MODE = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : 'report'
const LAUNCHABLE = new Set(['playable', 'verified'])
// 只有这些「核心条目」允许出现在 05 卡的规则链接里（`script` 是幕/议程的通用条目，`parley` 是共享关键词）。
const SHARED_RULE_IDS = ['parley', 'script']

const root = new URL('../', import.meta.url)
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const readText = path => (existsSync(new URL(path, root)) ? readFileSync(new URL(path, root), 'utf8') : null)
const sha256File = path => {
  const text = readText(path)
  return text === null ? null : sha256(Buffer.from(text, 'utf8'))
}
// 二进制证据（图片/音频）按原始字节哈希，不经过 UTF-8 文本往返。
const sha256BinaryFile = path => {
  const url = new URL(path, root)
  return existsSync(url) ? sha256(readFileSync(url)) : null
}
const readJson = path => {
  const text = readText(path)
  if (text === null) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- 内容与范围基线（P1）

const scopeBytes = readFileSync(new URL('../' + SCOPE_PATH, import.meta.url))
const scope = JSON.parse(scopeBytes.toString('utf8'))

const packs = PACK_IDS.map(id => {
  const pack = contentRegistry.getPack(id)
  if (!pack) return { id, exists: false }
  return {
    id,
    exists: true,
    status: pack.status,
    cards: pack.cards.length,
    ranges: pack.cardRanges.map(range => `${range.from}-${range.to}`),
    encounterGroupIds: [...pack.encounterGroupIds],
    rulesImplemented: pack.cards.filter(card => card.rulesImplemented).length,
    deckbuildingOpen: pack.cards.filter(card => card.deckbuilding).length,
  }
})

const campaign = contentRegistry.getCampaign(CAMPAIGN_ID)
let launchBlocked = false
let launchError = null
try {
  contentRegistry.assertLaunchable(CAMPAIGN_ID)
} catch (error) {
  launchBlocked = true
  launchError = error.message
}

const scenarios = contentRegistry.listScenarios(CAMPAIGN_ID).map(entry => ({
  id: entry.id,
  status: entry.status,
  referenceCode: entry.referenceCode || null,
  requiredPackIds: [...entry.requiredPackIds],
  requiredEncounterGroupIds: [...entry.requiredEncounterGroupIds],
  launchable: LAUNCHABLE.has(entry.status),
}))

const packGroupIds = packs.find(pack => pack.id === 'tcuCampaign')?.encounterGroupIds || []
// 章节可以引用**核心/前循环**的已登记遭遇组（chillingCold、ancientEvils 等，见路线图 §3.3 D5），
// 它们登记在 core 等依赖包里，不属于 tcuCampaign 的 21 个组；所以合法组集合 = 战役与各章
// requiredPackIds 闭包里所有包登记的 encounterGroupIds。
const requiredPackClosure = new Set(campaign?.requiredPackIds || [])
for (const scenario of contentRegistry.listScenarios(CAMPAIGN_ID)) {
  for (const packId of scenario.requiredPackIds || []) requiredPackClosure.add(packId)
}
const groupUniverse = new Set([...requiredPackClosure].flatMap(id => contentRegistry.getPack(id)?.encounterGroupIds || []))
const missingChapterGroups = scenarios.flatMap(scenario =>
  scenario.requiredEncounterGroupIds.filter(group => !groupUniverse.has(group)).map(group => `${scenario.id}:${group}`))
const packCountMismatch = [
  packs.find(pack => pack.id === 'tcuCampaign')?.cards !== CAMPAIGN_CARD_CODES.length,
  packs.find(pack => pack.id === 'tcuInvestigators')?.cards !== INVESTIGATOR_CARD_CODES.length,
  packs.find(pack => pack.id === 'tcuPlayer')?.cards !== PLAYER_CARD_CODES.length,
].some(Boolean)

// ---------------------------------------------------------------- 关键词与规则书（P4）

const ruleIds = new Set(RULES.map(rule => rule.id))
const tcuRules = RULES.filter(rule => rule.group === '万象无终')
const tcuRuleIds = new Set(tcuRules.map(rule => rule.id))
const indexedRules = new Map(RULE_INDEX.map(rule => [rule.id, rule]))
const tcuCards = Object.entries(ALL_CARDS).filter(([code]) => /^05\d{3}[a-z]?$/.test(code))

// Node 验收：实跑一次，所有关键词与规则书条目共用同一份结果（不读源码猜结论）。
// 清掉 NODE_TEST_CONTEXT：从 `node --test` 里再 spawn `node --test` 时，继承的上下文会让子进程
// 走测试子进程模式（不输出 ℹ pass/ℹ fail 汇总），账本就与直接运行的结果不一致。
const testEnv = { ...process.env }
delete testEnv.NODE_TEST_CONTEXT
const testRun = spawnSync(process.execPath, ['--test', RULES_TEST_PATH], { cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', env: testEnv })
const testOutput = `${testRun.stdout || ''}\n${testRun.stderr || ''}`
const numberFrom = (label, output) => {
  const match = output.match(new RegExp(`(?:ℹ|#)\\s*${label}\\s+(\\d+)`))
  return match ? Number(match[1]) : -1
}
const nodeAcceptance = {
  command: `node --test ${RULES_TEST_PATH}`,
  status: testRun.status,
  tests: numberFrom('tests', testOutput),
  passed: numberFrom('pass', testOutput),
  failed: numberFrom('fail', testOutput),
  ok: testRun.status === 0 && numberFrom('fail', testOutput) === 0 && numberFrom('pass', testOutput) > 0,
}

const scan = readJson(MECHANISM_SCAN_PATH)
const scanMechanisms = scan?.mechanisms || []
const scanKeywordMechanisms = scanMechanisms.filter(item => item.keyword).map(item => item.id).sort()
const keywordMechanismIds = TCU_KEYWORDS.map(keyword => keyword.mechanismId).sort()

const cardTextOf = card => [card?.text, card?.textZh, (card?.traits || []).join(' '), card?.slot].filter(Boolean).join('\n')

function engineEvidence(keyword) {
  // 行为判据是「动态 import 后逐个检查导出与形状」（见 valueShapes），这里只做存在性初筛，避免未导出时抛错。
  return (keyword.engine || []).filter(entry => !existsSync(new URL('../' + entry.module, import.meta.url)))
    .map(entry => `缺少模块 ${entry.module}`)
}

// `values` 的形状检查需要真实运行模块；Node 侧用一次动态 import 拿全量导出。
const moduleCache = new Map()
async function loadModule(modulePath) {
  if (!moduleCache.has(modulePath)) moduleCache.set(modulePath, await import(new URL('../' + modulePath, import.meta.url)))
  return moduleCache.get(modulePath)
}

async function valueShapes(keyword) {
  const problems = []
  for (const entry of keyword.engine || []) {
    let module
    try {
      module = await loadModule(entry.module)
    } catch (error) {
      problems.push(`${entry.module} 无法 import：${error.message}`)
      continue
    }
    for (const name of entry.names || []) {
      if (typeof module[name] !== 'function') problems.push(`${entry.module} 的 ${name} 不是函数`)
    }
    for (const value of entry.values || []) {
      const actual = module[value.name]
      if (actual === undefined) {
        problems.push(`${entry.module} 缺少导出 ${value.name}`)
        continue
      }
      if (typeof value.length === 'number' && actual.length !== value.length)
        problems.push(`${entry.module} 的 ${value.name} 长度应为 ${value.length}，实际 ${actual.length}`)
      if (Array.isArray(value.keys)) {
        const keys = Object.keys(actual).sort()
        if (keys.join(',') !== [...value.keys].sort().join(','))
          problems.push(`${entry.module} 的 ${value.name} 键应为 ${value.keys.join('/')}`)
      }
    }
  }
  return problems
}

// 规则书条目在标题/别名/正文里搜得到该关键词的中文名，才算「卡文与详情页直达」。
const ruleMentions = (rule, word) => {
  if (!rule) return false
  const haystack = `${rule.title} ${rule.aliases.join(' ')} ${rule.body.join('')}`.toLowerCase()
  return haystack.includes(String(word).toLowerCase())
}

const keywordItems = []
for (const keyword of TCU_KEYWORDS) {
  const rule = RULES.find(candidate => candidate.id === keyword.ruleId) || null
  const pattern = keyword.pattern ? new RegExp(keyword.pattern, 'i') : null
  // 1) 卡面来源
  const sourceProblems = []
  if (keyword.sourceKind === 'text') {
    if (!keyword.cardCodes.length) sourceProblems.push('没有列任何代表卡号')
    for (const code of keyword.cardCodes) {
      const card = ALL_CARDS[code]
      if (!card) sourceProblems.push(`卡号 ${code} 不存在`)
      else if (!pattern.test(cardTextOf(card))) sourceProblems.push(`${code} 的卡面没有印刷该关键词`)
    }
  } else if (keyword.sourceKind === 'card-kind') {
    if (!keyword.cardCodes.length) sourceProblems.push('没有列任何代表卡号')
    for (const code of keyword.cardCodes) {
      const card = ALL_CARDS[code]
      if (!card) sourceProblems.push(`卡号 ${code} 不存在`)
      else if (!(keyword.cardTypes || []).includes(card.type)) sourceProblems.push(`${code} 的类型是 ${card.type}`)
    }
  } else if (keyword.sourceKind === 'engine') {
    if (keyword.cardCodes.length) sourceProblems.push('engine 来源不应列卡号')
    if (!(keyword.engine || []).some(entry => (entry.values || []).length)) sourceProblems.push('engine 来源必须声明至少一个数据导出')
  } else {
    sourceProblems.push(`未知的 sourceKind：${keyword.sourceKind}`)
  }
  // 2) 引擎行为（导出名 + 形状）
  const engineProblems = [...engineEvidence(keyword), ...(await valueShapes(keyword))]
  // 3) 规则书条目
  const ruleProblems = []
  if (!rule) ruleProblems.push(`规则条目 ${keyword.ruleId} 不存在`)
  else {
    if (keyword.ruleOwned && rule.group !== '万象无终') ruleProblems.push(`${keyword.ruleId} 不在「万象无终」分组`)
    if (rule.body.join('').length < 80) ruleProblems.push(`${keyword.ruleId} 正文过短`)
    if (!ruleMentions(rule, keyword.zh)) ruleProblems.push(`${keyword.ruleId} 搜不到「${keyword.zh}」`)
    if (!indexedRules.has(keyword.ruleId)) ruleProblems.push(`${keyword.ruleId} 不在拼音索引里`)
  }
  // 4) 卡文直达：列出的卡号必须连到该条目；有 pattern 的还要逐张覆盖全部 05 卡。
  const linkProblems = []
  for (const code of keyword.cardCodes) {
    const card = ALL_CARDS[code]
    if (card && !cardRuleIds(card).includes(keyword.ruleId)) linkProblems.push(`${code} 没有连到 ${keyword.ruleId}`)
  }
  if (pattern) {
    for (const [code, card] of tcuCards) {
      if (pattern.test(cardTextOf(card)) && !cardRuleIds(card).includes(keyword.ruleId))
        linkProblems.push(`${code} 卡面命中判据但没有连到 ${keyword.ruleId}`)
    }
  }
  const checks = {
    sourceInventoried: sourceProblems.length === 0,
    engineBehavior: engineProblems.length === 0,
    nodeAcceptance: nodeAcceptance.ok,
    rulebookEntry: ruleProblems.length === 0,
    cardLinks: linkProblems.length === 0,
  }
  keywordItems.push({
    id: keyword.id,
    printed: keyword.printed,
    zh: keyword.zh,
    kind: keyword.kind,
    ruleId: keyword.ruleId,
    mechanismId: keyword.mechanismId,
    ruleOwned: keyword.ruleOwned,
    implemented: keyword.implemented !== false,
    sourceKind: keyword.sourceKind,
    cardCodes: [...keyword.cardCodes],
    cardLinkMode: keyword.cardCodes.length ? 'cards' : 'none',
    status: Object.values(checks).every(Boolean) ? 'verified' : 'pending',
    checks,
    problems: [...sourceProblems, ...engineProblems, ...ruleProblems, ...linkProblems],
    evidence: [
      KEYWORDS_PATH,
      RULEBOOK_PATH,
      RULES_TEST_PATH,
      ...(keyword.engine || []).map(entry => `${entry.module}#${[...(entry.names || []), ...(entry.values || []).map(value => value.name)].join(',')}`),
      ...keyword.cardCodes.map(code => `src/cards/cards-data.js#${code}`),
    ],
  })
}

const keywordFailures = keywordItems.filter(item => item.status !== 'verified')
const keywordsStatus = keywordFailures.length === 0 ? 'verified' : 'pending'

// 机制扫描对齐：关键词表必须与第 1 步扫描的机制集合、ruleId 一一对齐。
const scanAlignment = {
  scanMechanisms: scanKeywordMechanisms,
  keywordMechanisms: keywordMechanismIds,
  missing: keywordMechanismIds.filter(id => !scanKeywordMechanisms.includes(id)),
  extra: scanKeywordMechanisms.filter(id => !keywordMechanismIds.includes(id)),
  ruleIdMismatch: TCU_KEYWORDS.filter(keyword => {
    const mechanism = scanMechanisms.find(item => item.id === keyword.mechanismId)
    return mechanism?.keyword?.ruleId !== keyword.ruleId
  }).map(keyword => keyword.id),
}
scanAlignment.pass = scanAlignment.missing.length === 0 && scanAlignment.extra.length === 0
  && scanAlignment.ruleIdMismatch.length === 0

// 规则书条目：16 条必须成对出现（条目 / 拼音索引），且不能有孤儿条目。
const rulebookIds = new Set(TCU_RULE_IDS)
const missingRuleEntries = TCU_RULE_IDS.filter(id => !ruleIds.has(id))
const orphanTcuRules = [...tcuRuleIds].filter(id => !rulebookIds.has(id))
const unindexedRuleIds = TCU_RULE_IDS.filter(id => !indexedRules.has(id))
const badSortKeys = TCU_RULE_IDS.filter(id => {
  const indexed = indexedRules.get(id)
  return !indexed || !/^[a-z]+$/.test(String(indexed.sortKey || '')) || indexed.initial !== indexed.sortKey[0].toUpperCase()
})

// 章节覆盖：章节清单、剧本参考卡、卡文直达三处必须一致。
const chapterChecks = chapters.map(chapter => {
  const referenceCard = ALL_CARDS[chapter.code] || null
  const scenarioCard = UI_CARDS.scenarioCards[chapter.id] || null
  const links = referenceCard ? cardRuleIds(referenceCard) : []
  const scenario = scenarios.find(entry => entry.id === chapter.id) || null
  const checks = {
    chapterRegistered: Boolean(scenario),
    referenceCardExists: Boolean(referenceCard) && referenceCard.type === 'scenario',
    scenarioCardMapped: scenarioCard === chapter.code,
    linksCampaignRule: links.includes('tcuCampaign'),
    linksChaosRule: links.includes('tcuChaos'),
  }
  return {
    id: chapter.id,
    code: chapter.code,
    name: chapter.name,
    status: scenario?.status ?? null,
    scenarioCard,
    status2: Object.values(checks).every(Boolean) ? 'ok' : 'pending',
    checks,
  }
})

// campaignOverview：规则书的战役条目只写规则：章节名、混乱袋构成、战役记录与相关跳转。
const campaignRule = RULES.find(rule => rule.id === 'tcuCampaign') || null
const campaignBody = campaignRule ? campaignRule.body.join('') : ''
const campaignOverviewChecks = {
  entryPresent: Boolean(campaignRule) && campaignRule.group === '万象无终',
  listsEveryChapter: chapters.every(chapter => campaignBody.includes(chapter.name)),
  statesCampaignRecords: campaignBody.includes('战役记录'),
  statesChaosBagShape: campaignBody.includes('13 枚'),
  relatedRulesExist: (campaignRule?.related || []).every(id => ruleIds.has(id)),
  rulesOnly: !/本局|本 Mod|引擎|实现|界面|按钮|面板|拖动|点击|演出|存档|投影|原语|读点|接线|验收|审计|playable|earlyAccess|audit|src\/|content\/|behavior/.test(campaignBody),
}

// scenarioMechanics：每章都要有剧本参考卡、提示卡映射与两条卡文直达。
const scenarioMechanicsChecks = {
  chapters: chapterChecks.length,
  allChaptersOk: chapterChecks.every(item => item.status2 === 'ok'),
  scenarioCardCount: Object.keys(UI_CARDS.scenarioCards).filter(id => chapters.some(chapter => chapter.id === id)).length,
}

// keywordEntries：每条关键词都指向真实条目，且中文名可搜到。
const keywordEntriesChecks = {
  entries: keywordItems.length,
  entriesPresent: keywordItems.every(item => ruleIds.has(item.ruleId)),
  searchable: keywordItems.every(item => ruleMentions(RULES.find(rule => rule.id === item.ruleId), item.zh)),
  status: keywordsStatus,
}

// cardLinks：05 段每张卡至少连到战役条目，且不误连其他循环的条目。
const foreignLinks = []
const unlinkedCards = []
for (const [code, card] of tcuCards) {
  const ids = cardRuleIds(card)
  if (!ids.length) unlinkedCards.push(code)
  for (const id of ids) if (!rulebookIds.has(id) && !SHARED_RULE_IDS.includes(id)) foreignLinks.push(`${code}:${id}`)
}
const cardLinksChecks = {
  cards: tcuCards.length,
  everyCardLinked: unlinkedCards.length === 0,
  noForeignCycleLinks: foreignLinks.length === 0,
  unlinkedCards,
  foreignLinks,
}

// ---------------------------------------------------------------- 浏览器证据（runner 生成）

const browserReport = readJson(BROWSER_PATH)
// 截图放在仓库根的 artifacts/ 下（与 TFA 同一约定），路径由 reporter 以仓库相对路径记录。
// 工具在 games/arkhamhorror/tools/：包内路径 '../' 落回 games/arkhamhorror/，仓库根要再上两层。
const repoPathExists = shot => Boolean(shot?.path)
  && existsSync(new URL((shot.base === 'repo-root' ? '../../../' : '../') + shot.path, import.meta.url))
const browserScreenshots = Array.isArray(browserReport?.screenshots) ? browserReport.screenshots : []
const browserTests = Array.isArray(browserReport?.tests) ? browserReport.tests : []
const browserSpecs = Array.isArray(browserReport?.specs) ? browserReport.specs : []
const passedFor = (spec, viewport) => browserTests.some(test =>
  test.spec === spec && test.viewport === viewport && test.status === 'passed')
const shotFor = (spec, viewport) => browserScreenshots.some(shot =>
  shot.spec === spec && shot.viewport === viewport && repoPathExists(shot))
const browserChecks = {
  reportPresent: Boolean(browserReport),
  generatedByRunner: typeof browserReport?.generatedBy === 'string' && /playwright/i.test(browserReport.generatedBy),
  specs: browserTests.length ? [...new Set(browserTests.map(test => test.spec))].sort() : browserSpecs,
  specReported: browserSpecs.includes(BROWSER_SPEC_PATH) || browserTests.some(test => test.spec === BROWSER_SPEC_PATH),
  statusPassed: browserReport?.status === 'passed',
  tests: browserTests.length,
  // P4（规则书）与 P5（交互）分开取证：每个 spec × 视口都要有用例通过 + 截图。
  rulesDesktop: passedFor(BROWSER_SPEC_PATH, 'desktop') && shotFor(BROWSER_SPEC_PATH, 'desktop'),
  rulesMobile: passedFor(BROWSER_SPEC_PATH, 'mobile') && shotFor(BROWSER_SPEC_PATH, 'mobile'),
  interactionsDesktop: passedFor(INTERACTIONS_SPEC_PATH, 'desktop') && shotFor(INTERACTIONS_SPEC_PATH, 'desktop'),
  interactionsMobile: passedFor(INTERACTIONS_SPEC_PATH, 'mobile') && shotFor(INTERACTIONS_SPEC_PATH, 'mobile'),
  desktop: browserReport?.checks?.desktopBrowser === true,
  mobile: browserReport?.checks?.mobileBrowser === true,
  // 截图必须真的在仓库里存在，且桌面/移动各一张。
  screenshots: browserScreenshots.filter(repoPathExists).length,
  screenshotsComplete: browserScreenshots.length > 0 && browserScreenshots.every(repoPathExists)
    && ['desktop', 'mobile'].every(viewport => browserScreenshots.some(shot => shot.viewport === viewport && repoPathExists(shot))),
}
const browserOk = browserChecks.reportPresent && browserChecks.generatedByRunner && browserChecks.specReported
  && browserChecks.statusPassed && browserChecks.tests > 0 && browserChecks.screenshotsComplete
const interactionsBrowserOk = browserOk && browserChecks.interactionsDesktop && browserChecks.interactionsMobile

const rulebookChecks = {
  campaignOverview: Object.values(campaignOverviewChecks).every(Boolean),
  scenarioMechanics: scenarioMechanicsChecks.allChaptersOk
    && scenarioMechanicsChecks.scenarioCardCount === chapters.length
    && scenarioMechanicsChecks.chapters === chapters.length,
  keywordEntries: Object.entries(keywordEntriesChecks).every(([key, value]) => key === 'status' ? value === 'verified' : Boolean(value)),
  cardLinks: cardLinksChecks.everyCardLinked && cardLinksChecks.noForeignCycleLinks && cardLinksChecks.cards === 377,
  desktopBrowser: browserOk && browserChecks.rulesDesktop,
  mobileBrowser: browserOk && browserChecks.rulesMobile,
}
const rulebookStatus = Object.values(rulebookChecks).every(Boolean) ? 'verified' : 'pending'

// ---------------------------------------------------------------- 交互与界面（P5）

// 路线图 §6 的 11 条交互。`model` 是 web/tcu-ui.js 的导出（纯函数，Node 侧可 import），
// `keyword` 是 P4 关键词台账里对应的机制 id；两者至少命中一个才算「有界面读点」。
const INTERACTIONS = [
  { id: 'tarotPick', zh: '塔罗抽牌/选择', model: ['tarotPickerModel', 'renderTarotPicker'], keyword: 'tarotDeck' },
  { id: 'storyInvestigatorPick', zh: '序章选调查员', model: ['storyInvestigatorPickerModel', 'renderStoryInvestigatorPicker'], keyword: 'storyInvestigator' },
  { id: 'hauntedResolution', zh: '闹鬼结算', model: ['hauntedChoiceModel', 'renderHauntedChoice'], keyword: 'haunted' },
  { id: 'spectralDeck', zh: '幽灵界第二牌堆面板', model: ['tcuCampaignModel', 'renderTcuCampaignPanel'], keyword: 'spectral' },
  { id: 'circleTest', zh: '阵法多技能检定', model: ['multiSkillTestInfo'], keyword: 'circle' },
  { id: 'parleyTarget', zh: '谈判目标与豁免', model: [], keyword: 'parley' },
  { id: 'campaignRecords', zh: '遗留记忆/记录面板', model: ['tcuCampaignModel'], keyword: 'memento' },
  { id: 'watcherPanel', zh: '看守人公开提示', model: ['tcuCampaignModel'], keyword: 'watcher' },
  { id: 'breachDoom', zh: '裂口/毁灭标记', model: ['locationTcuBadges'], keyword: 'breach' },
  { id: 'hereticFaces', zh: '异端者翻面/放逐', model: ['enemyFaceBadge'], keyword: 'heretic' },
  { id: 'tarotSlot', zh: '塔罗槽位', model: [], keyword: 'tarotSlot' },
]
const interactionsNodeAcceptance = spawnSync(process.execPath, ['--test', INTERACTIONS_TEST_PATH], {
  cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', env: testEnv,
})
const interactionsOutput = `${interactionsNodeAcceptance.stdout || ''}\n${interactionsNodeAcceptance.stderr || ''}`
const interactionsAcceptance = {
  command: `node --test ${INTERACTIONS_TEST_PATH}`,
  status: interactionsNodeAcceptance.status,
  tests: numberFrom('tests', interactionsOutput),
  passed: numberFrom('pass', interactionsOutput),
  failed: numberFrom('fail', interactionsOutput),
  ok: interactionsNodeAcceptance.status === 0 && numberFrom('fail', interactionsOutput) === 0 && numberFrom('pass', interactionsOutput) > 0,
}
const tcuUi = await import('../web/tcu-ui.js')
const interactionItems = INTERACTIONS.map(item => {
  const keyword = TCU_KEYWORDS.find(entry => entry.id === item.keyword) || null
  const modelProblems = item.model.filter(name => typeof tcuUi[name] !== 'function').map(name => `缺少导出 ${name}`)
  const keywordProblems = keyword ? [] : [`关键词台账缺少 ${item.keyword}`]
  const checks = {
    model: modelProblems.length === 0,
    engineReadPoint: keyword ? (keyword.engine || []).length > 0 : false,
    nodeAcceptance: interactionsAcceptance.ok,
    desktopBrowser: interactionsBrowserOk,
    mobileBrowser: interactionsBrowserOk,
  }
  return {
    id: item.id,
    zh: item.zh,
    keyword: item.keyword,
    model: item.model,
    status: Object.values(checks).every(Boolean) ? 'verified' : 'pending',
    checks,
    problems: [...modelProblems, ...keywordProblems],
    evidence: item.model.length ? ['web/tcu-ui.js', 'web/tcu-panels.css', INTERACTIONS_TEST_PATH, INTERACTIONS_SPEC_PATH] : [KEYWORDS_PATH, INTERACTIONS_SPEC_PATH],
  }
})
const interactionFailures = interactionItems.filter(item => item.status !== 'verified')
const interactionsStatus = interactionFailures.length === 0 ? 'verified' : 'pending'

// ---------------------------------------------------------------- 调查员（P6 · M1）

// 每位正式调查员的验收口径：可选人、可构筑、条目齐全、专属卡已实现、规则数据合法、
// 自动构筑产出与卡面契约一致。任何一项为 false 就不算 verified，并进 remaining。
function problemOf(fn) {
  try {
    fn()
    return null
  } catch (error) {
    return error.message
  }
}

function validateInvestigatorData(code) {
  const data = investigatorRule(code) || {}
  if (!data.elderSign) throw new Error('缺少 investigator.elderSign 数据体')
  if (data.hunchDeck) normalizeHunchDeckRule(data.hunchDeck, `${code}.hunchDeck`)
  if (data.resourceBank) normalizeResourceBankRule(data.resourceBank, `${code}.resourceBank`)
  if (data.spellActionCredit) {
    const doomAtLeast = data.spellActionCredit.doomAtLeast ?? 1
    if (!Number.isSafeInteger(doomAtLeast) || doomAtLeast < 1) throw new Error('spellActionCredit.doomAtLeast 必须是正整数')
  }
  for (const extra of data.openingHandExtra || []) {
    if (!ALL_CARDS[extra]) throw new Error(`openingHandExtra 指向未知卡牌：${extra}`)
  }
}

const formalInvestigatorItems = INVESTIGATOR_CODES.map(code => {
  const card = ALL_CARDS[code]
  const entry = registeredEntry(code)
  const availability = getAvailability(code)
  const signatureCodes = SIGNATURES_BY_INVESTIGATOR[code] || []
  const problems = []
  const dataProblem = problemOf(() => validateInvestigatorData(code))
  if (dataProblem) problems.push(dataProblem)
  let built = null
  const deckProblem = problemOf(() => { built = buildDeck(INVESTIGATORS[code], { seed: `audit-${code}` }) })
  if (deckProblem) problems.push(`自动构筑失败：${deckProblem}`)
  if (built) {
    if (built.playerCards.length !== card?.deckRequirements?.size) {
      problems.push(`玩家卡 ${built.playerCards.length} 张，卡面要求 ${card?.deckRequirements?.size}`)
    }
    if (built.signatureCards.length + built.signatureWeaknesses.length !== signatureCodes.length) {
      problems.push('专属卡/专属弱点数量与构筑依赖不一致')
    }
    if (built.basicWeaknesses.length !== 1) problems.push('随机基础弱点数量不为 1')
  }
  const checks = {
    selectable: canSelectInvestigator(code) && availability.selectable,
    deckbuildingOpen: availability.availability === 'strict' && !availability.dependencyOnly,
    dataDeclared: Boolean(entry?.investigator) && Boolean(entry?.elderSign),
    signaturesImplemented: signatureCodes.every(signature => tcuInvestigatorCardVerified(signature)
      && Boolean(registeredEntry(signature))),
    ruleDataValid: !dataProblem,
    deckContract: Boolean(built) && problems.length === 0,
    nodeAcceptance: false, // 由下面实测后统一回填
  }
  return { code, name: card?.nameZh || card?.name || code, klass: card?.klass || null, signatureCodes, checks, problems }
})

const storyInvestigatorItems = STORY_INVESTIGATOR_CODES.map(code => {
  const card = ALL_CARDS[code]
  const entry = registeredEntry(code)
  const checks = {
    registered: entry?.kind === 'investigator',
    notSelectable: !canSelectInvestigator(code) && getAvailability(code).selectable === false,
    elderSign: Boolean(entry?.elderSign) && Boolean(investigatorRule(code)?.elderSign),
    inCampaignPack: CAMPAIGN_CARD_CODES.includes(code),
  }
  const problems = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key)
  return { code, name: card?.nameZh || card?.name || code, checks, problems }
})

const investigatorRun = spawnSync(process.execPath, ['--test', INVESTIGATOR_TEST_PATH], {
  cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', env: testEnv,
})
const investigatorOutput = `${investigatorRun.stdout || ''}\n${investigatorRun.stderr || ''}`
const investigatorAcceptance = {
  command: `node --test ${INVESTIGATOR_TEST_PATH}`,
  status: investigatorRun.status,
  tests: numberFrom('tests', investigatorOutput),
  passed: numberFrom('pass', investigatorOutput),
  failed: numberFrom('fail', investigatorOutput),
  ok: investigatorRun.status === 0 && numberFrom('fail', investigatorOutput) === 0
    && numberFrom('pass', investigatorOutput) > 0,
}
for (const item of formalInvestigatorItems) item.checks.nodeAcceptance = investigatorAcceptance.ok
for (const item of formalInvestigatorItems) {
  item.status = Object.values(item.checks).every(Boolean) ? 'verified' : 'pending'
}
const formalPending = formalInvestigatorItems.filter(item => item.status !== 'verified')
const storyProblems = storyInvestigatorItems.filter(item => item.problems.length)
const investigatorsStatus = formalPending.length === 0 && storyProblems.length === 0
  && investigatorAcceptance.ok ? 'verified' : 'pending'

// 条目里显式声明的简化分支（`simplified: true` + note）不能静默通过：
// 它们进 remaining，并在账本里逐条列出来。P7 起 M2 玩家卡的条目也一起扫。
const simplifiedCards = [...new Set([
  ...PACK_INVESTIGATOR_CODES, ...TCU_SIGNATURE_CODES, ...STORY_INVESTIGATOR_CODES, ...PLAYER_CARD_CODES,
])]
  .map(code => ({ code, name: ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code, note: registeredEntry(code)?.note || null }))
  .filter(item => registeredEntry(item.code)?.simplified === true)


// ---------------------------------------------------------------- 玩家卡（P7 · M2）

// 验收口径：逐卡证据来自 tools/audit-tcu-player.mjs 的实跑结果（它不是读冻结 JSON，而是先跑 4 个分片测试
// 再逐字节比对账本/模块）。这里再套一层独立检查：包清单 rulesImplemented、availability 的 strict/构筑状态，
// 以及 ledger 测试（接线与可复算）是否通过。任何一项为 false 就不算 verified 并进 remaining。
const playerRun = spawnSync(process.execPath, [PLAYER_ACCEPTANCE_TOOL_PATH], {
  cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', env: testEnv,
})
// 先实跑验收工具，再读它（重新）写出的账本：`--write` 顺序是 player --write → audit-tcu --write，
// 这里读到的就是刚生成/刚复算过的那一份；账本缺失或过期时账本条目缺失，gate 会失败而不是停在旧结论。
const playerLedger = readJson(PLAYER_ACCEPTANCE_LEDGER_PATH)
const playerAcceptance = {
  command: `node ${PLAYER_ACCEPTANCE_TOOL_PATH}`,
  status: playerRun.status,
  ok: playerRun.status === 0,
  summary: playerLedger?.summary ?? null,
}
const playerLedgerRun = spawnSync(process.execPath, ['--test', PLAYER_LEDGER_TEST_PATH], {
  cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', env: testEnv,
})
const playerLedgerOutput = `${playerLedgerRun.stdout || ''}\n${playerLedgerRun.stderr || ''}`
const playerLedgerAcceptance = {
  command: `node --test ${PLAYER_LEDGER_TEST_PATH}`,
  status: playerLedgerRun.status,
  tests: numberFrom('tests', playerLedgerOutput),
  passed: numberFrom('pass', playerLedgerOutput),
  failed: numberFrom('fail', playerLedgerOutput),
  ok: playerLedgerRun.status === 0 && numberFrom('fail', playerLedgerOutput) === 0
    && numberFrom('pass', playerLedgerOutput) > 0,
}
const playerPack = contentRegistry.getPack('tcuPlayer')
const playerPackCards = playerPack?.cards ?? []
const playerLedgerEntries = new Map((playerLedger?.entries || []).map(entry => [entry.code, entry]))
const playerItems = PLAYER_CARD_CODES.map(code => {
  const card = ALL_CARDS[code]
  const availability = getAvailability(code)
  const ledgered = playerLedgerEntries.get(code) || null
  const basicWeakness = TCU_PLAYER_BASIC_WEAKNESS_CODES.includes(code)
  const checks = {
    printedEffectEvidence: Boolean(ledgered) && ledgered.status === 'verified'
      && Array.isArray(ledgered.evidence) && ledgered.evidence.length > 0,
    packaged: playerPackCards.some(item => item.code === code && item.rulesImplemented === true),
    availability: availability.availability === 'strict',
    deckbuilding: availability.deckbuilding === !basicWeakness,
    dependencyOnly: availability.dependencyOnly === basicWeakness,
    nodeAcceptance: playerAcceptance.ok,
  }
  return {
    code,
    name: card?.nameZh || card?.name || code,
    type: card?.type || null,
    class: card?.klass || null,
    level: card?.xp || 0,
    basicWeakness,
    status: Object.values(checks).every(Boolean) ? 'verified' : 'pending',
    checks,
    evidence: ledgered?.evidence ?? [],
  }
})
const playerPending = playerItems.filter(item => item.status !== 'verified')
const playerBuildable = playerPackCards.filter(card => card.deckbuilding).length
const playerStatus = playerItems.length === 87 && playerPending.length === 0
  && playerAcceptance.ok && playerLedgerAcceptance.ok && playerBuildable === 85 ? 'verified' : 'pending'
const playerPackInfo = packs.find(pack => pack.id === 'tcuPlayer')

// ---------------------------------------------------------------- 剧本（P8 · M3）

// 验收口径：逐章证据来自 tools/audit-tcu-scenarios.mjs 的实跑结果——它动态 import 各章 index.js、
// 计算区域/身份/逐卡条目/参考实现哈希，并 spawnSync 实跑该章测试（存档回放用例）。这里再套一层独立检查：
// 章节包清单 rulesImplemented、章节状态 development、账本测试（recomputable）与 12 项检查计数。
// `--write` 时先让工具写账本再读；`--check` 时只读不写，账本漂移即失败。
const scenarioRun = spawnSync(process.execPath, [SCENARIO_ACCEPTANCE_TOOL_PATH, MODE === 'write' ? '--write' : '--check'], {
  cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', env: testEnv,
})
const scenarioLedger = readJson(SCENARIO_ACCEPTANCE_LEDGER_PATH)
const scenarioAcceptance = {
  // 命令串不带 --write/--check：账本里记录的是稳定证据口径，--check 复算必须逐字节一致。
  command: `node ${SCENARIO_ACCEPTANCE_TOOL_PATH}`,
  status: scenarioRun.status,
  ok: scenarioRun.status === 0 && Boolean(scenarioLedger),
  summary: scenarioLedger?.summary ?? null,
}
const scenarioLedgerRun = spawnSync(process.execPath, ['--test', SCENARIO_LEDGER_TEST_PATH], {
  cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', env: testEnv,
})
const scenarioLedgerOutput = `${scenarioLedgerRun.stdout || ''}\n${scenarioLedgerRun.stderr || ''}`
const scenarioLedgerAcceptance = {
  command: `node --test ${SCENARIO_LEDGER_TEST_PATH}`,
  status: scenarioLedgerRun.status,
  tests: numberFrom('tests', scenarioLedgerOutput),
  passed: numberFrom('pass', scenarioLedgerOutput),
  failed: numberFrom('fail', scenarioLedgerOutput),
  ok: scenarioLedgerRun.status === 0 && numberFrom('fail', scenarioLedgerOutput) === 0
    && numberFrom('pass', scenarioLedgerOutput) > 0,
}
const scenarioPack = contentRegistry.getPack('tcuCampaign')
const scenarioItems = scenarioLedger?.items ?? []
const scenarioChecksOf = item => Object.entries(item?.checks || {})
const scenarioPending = scenarioItems.filter(item => item.status === 'pending')
const scenarioNodeVerified = scenarioItems.filter(item =>
  scenarioChecksOf(item).every(([key, value]) => key === 'browserAcceptance' || value === true))
const scenarioFullyVerified = scenarioItems.filter(item =>
  scenarioChecksOf(item).every(([, value]) => value === true))
const scenarioBrowserPending = scenarioItems.filter(item => item.checks && item.checks.browserAcceptance !== true)
const scenarioStatus = scenarioItems.length === 9 && scenarioPending.length === 0
  && scenarioAcceptance.ok && scenarioLedgerAcceptance.ok ? 'development' : 'pending'
const scenarioStatusVerified = scenarioItems.length === 9 && scenarioFullyVerified.length === 9
  && scenarioAcceptance.ok && scenarioLedgerAcceptance.ok ? 'verified' : 'pending'
const scenarioGapsCount = scenarioItems.reduce((sum, item) => sum + (item.gaps?.length || 0), 0)
const scenarioPendingCards = scenarioItems.reduce((sum, item) => sum + (item.pendingEncounterCodes?.length || 0), 0)
const scenarioTestFiles = scenarioItems.map(item => item.testFile).filter(Boolean)

// ---------------------------------------------------------------- 发布（P10 · M5）

// 逐卡账本：tools/audit-tcu-all-cards.mjs 先实跑 6 个逐卡测试（调查员 + 4 个玩家分片 + 战役字面测试），
// 再按 `TCU <code>` 前缀归集逐卡证据并逐字节比对账本/运行时模块。这里只读它的实跑结论，不复制冻结 JSON。
const allCardsRun = spawnSync(process.execPath, [ALL_CARDS_TOOL_PATH, '--check'], {
  cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', env: testEnv,
})
const allCardsLedger = readJson(ALL_CARDS_LEDGER_PATH)
const allCardsTool = {
  command: `node ${ALL_CARDS_TOOL_PATH} --check`,
  status: allCardsRun.status,
  ok: allCardsRun.status === 0 && Boolean(allCardsLedger),
}
const allCardsEntries = Array.isArray(allCardsLedger?.entries) ? allCardsLedger.entries : []
const partitionOf = entry => entry.partition || null
const partitionCount = name => allCardsEntries.filter(entry => partitionOf(entry) === name).length
const allCardsVerifiedCodes = allCardsEntries.filter(entry => entry.status === 'verified').map(entry => entry.code)
const allCardsPendingCodes = allCardsEntries.filter(entry => entry.status !== 'verified').map(entry => entry.code)
const allCardsFaceCount = allCardsEntries.filter(entry => /^05\d{3}[a-z]$/.test(entry.code)).length
const allCardsRecordCount = allCardsEntries.length - allCardsFaceCount
const allCardsPartitions = {
  campaign: partitionCount('campaign'),
  investigator: partitionCount('investigator'),
  player: partitionCount('player'),
  face: Math.max(partitionCount('face'), allCardsFaceCount),
}
// 逐卡证据必须带确实存在的测试文件，且每条卡至少一条证据（不靠源码卡号搜索/空证据通过）。
const allCardsBadEvidence = allCardsEntries.filter(entry =>
  !Array.isArray(entry.evidence) || entry.evidence.length === 0
  || entry.evidence.some(item => !item?.file || !existsSync(new URL('../../../' + item.file, import.meta.url)))).map(entry => entry.code)
const allCardsSummary = allCardsLedger?.summary ?? null
const allCardsStatus = allCardsTool.ok && allCardsEntries.length === 377
  && allCardsRecordCount === 343 && allCardsFaceCount === 34
  && allCardsVerifiedCodes.length === 377 && allCardsPendingCodes.length === 0
  && allCardsBadEvidence.length === 0
  && allCardsPartitions.campaign === 237 && allCardsPartitions.investigator === 19
  && allCardsPartitions.player === 87 ? 'verified' : 'pending'

// 逐卡行为审计（P10）：读 audit/tcu-card-behavior-audit.json——每张 05 卡（含关联面）逐条核对
// 卡面印刷描述与实现后的结论：match / approximation / gap / not-applicable。它不冒充自动测试：
// 自动测试证据在 allCards 账本里；行为审计发现而尚未实现的子句以 gap 记账，并让发布口径转为
// earlyAccess（equivalenceCertified 始终 false），不宣称规则等价。
const cardBehaviorLedger = readJson(CARD_BEHAVIOR_LEDGER_PATH)
const cardBehaviorEntries = Array.isArray(cardBehaviorLedger?.entries) ? cardBehaviorLedger.entries : []
const cardBehaviorVerdicts = ['match', 'approximation', 'gap', 'not-applicable']
const cardBehaviorByVerdict = verdict => cardBehaviorEntries.filter(entry => entry.verdict === verdict)
const cardBehaviorGaps = cardBehaviorByVerdict('gap')
const cardBehaviorApproximations = cardBehaviorByVerdict('approximation')
const cardBehaviorBad = cardBehaviorEntries.filter(entry => !cardBehaviorVerdicts.includes(entry.verdict))
const cardBehaviorSummary = cardBehaviorLedger?.summary ?? null
const cardBehaviorComplete = cardBehaviorEntries.length === 377
  && cardBehaviorEntries.filter(entry => !/^05\d{3}[a-z]$/.test(entry.code)).length === 343
  && cardBehaviorEntries.filter(entry => /^05\d{3}[a-z]$/.test(entry.code)).length === 34
  && cardBehaviorBad.length === 0
const cardBehaviorAudit = {
  total: cardBehaviorEntries.length,
  mainCards: cardBehaviorEntries.length - cardBehaviorEntries.filter(entry => /^05\d{3}[a-z]$/.test(entry.code)).length,
  faces: cardBehaviorEntries.filter(entry => /^05\d{3}[a-z]$/.test(entry.code)).length,
  match: cardBehaviorByVerdict('match').length,
  approximation: cardBehaviorApproximations.length,
  gap: cardBehaviorGaps.length,
  notApplicable: cardBehaviorByVerdict('not-applicable').length,
  gapCodes: cardBehaviorGaps.map(entry => entry.code),
  approximationCodes: cardBehaviorApproximations.map(entry => entry.code),
  summary: cardBehaviorSummary,
  ledger: { path: CARD_BEHAVIOR_LEDGER_PATH, sha256: sha256File(CARD_BEHAVIOR_LEDGER_PATH) },
  covered: cardBehaviorComplete,
  pass: cardBehaviorComplete,
}

// 发布级实机浏览器证据：只读 runner 产物；要求 release（大厅→序章→章节）与 media（图片/音乐 200）
// 各桌面 + 移动通过，release 另需两张实机截图文件确实存在。P8 的逐章截图仍用于 12 项检查，两者不互相替代。
const specOf = entry => String(entry?.spec || entry?.file || '').replaceAll('\\', '/')
const releaseTests = browserTests.filter(entry => /tcu-release\.browser\.mjs$/.test(specOf(entry)))
const mediaTests = browserTests.filter(entry => /tcu-media\.browser\.mjs$/.test(specOf(entry)))
const repoFileExists = file => Boolean(file) && existsSync(new URL('../../../' + file, import.meta.url))
const releaseViewport = viewport => {
  const tests = releaseTests.filter(entry => entry.viewport === viewport && entry.status === 'passed')
  const shots = browserScreenshots.filter(entry =>
    /tcu-release\.browser\.mjs$/.test(specOf(entry)) && entry.viewport === viewport && repoFileExists(entry.path))
  return { passed: tests.length > 0, screenshots: shots.length, ok: tests.length > 0 && shots.length > 0 }
}
const releaseBrowserChecks = {
  releaseDesktop: releaseViewport('desktop').ok,
  releaseMobile: releaseViewport('mobile').ok,
  mediaDesktop: mediaTests.some(entry => entry.viewport === 'desktop' && entry.status === 'passed'),
  mediaMobile: mediaTests.some(entry => entry.viewport === 'mobile' && entry.status === 'passed'),
  specs: Array.isArray(browserReport?.specs) ? browserReport.specs.map(spec => String(spec).replaceAll('\\', '/')) : [],
}
const requiredBrowserSpecs = [BROWSER_SPEC_PATH, INTERACTIONS_SPEC_PATH, SCENARIO_BROWSER_SPEC_PATH, RELEASE_SPEC_PATH, MEDIA_SPEC_PATH]
const browserSpecsComplete = requiredBrowserSpecs.every(spec =>
  releaseBrowserChecks.specs.some(reported => reported.endsWith(spec.split('/').at(-1))))
const releaseBrowserStatus = browserReport?.generatedBy
  && Object.entries(releaseBrowserChecks).filter(([key]) => key !== 'specs').every(([, value]) => value === true)
  && browserSpecsComplete ? 'verified' : 'pending'

// 展示素材：战役主题引用的图片（9 张章节场景 + 桌面图 + 封面）+ 27 首 05 专属 BGM 必须实际存在且非空；
// BGM 的落盘口径：MUSIC_TRACKS 中 id 以 `tcu` 开头、file 指向 `common/*.mp3` 的条目
// （2026-10 P10 复核：早期按 file 以 `campaigns/theCircleUndone/` 开头过滤会恒得 0，属判据与落盘不符）。
// 每章歌单 2–3 首且全部能被上述 TCU 曲目解析（P8 已接线，P10 落盘）。
const localAssetPath = url => 'web/' + String(url || '').replace(/^\/mods\/arkhamhorror\//, '')
const themeAssetPaths = new Set()
const collectThemeAssets = theme => {
  for (const key of ['hubHero', 'tableOverlay', 'storyDefault']) {
    if (theme?.assets?.[key]) themeAssetPaths.add(localAssetPath(theme.assets[key]))
  }
}
collectThemeAssets(campaignPresentation(CAMPAIGN_ID))
for (const chapter of chapters) collectThemeAssets(campaignPresentation(CAMPAIGN_ID, chapter.id))
const presentationImages = [...themeAssetPaths].filter(assetPath => {
  const url = new URL('../' + assetPath, import.meta.url)
  return assetPath && existsSync(url) && readFileSync(url).length > 0
})
// TCU 27 首曲目：id 前缀 + 落盘到 web/audio/music/common/*.mp3 的双重校验，避免「素材在、判据前缀错」再次漏检。
const TCU_TRACK_ID = /^tcu/
const TCU_TRACK_FILE = /^common\/[^/]+\.mp3$/
const tcuTracks = MUSIC_TRACKS.filter(track =>
  TCU_TRACK_ID.test(String(track.id || '')) && TCU_TRACK_FILE.test(String(track.file || '')))
const tcuTrackFiles = tcuTracks.filter(track => {
  const url = new URL('../web/audio/music/' + track.file, import.meta.url)
  return existsSync(url) && readFileSync(url).length > 0
})
const tcuPlaylistChecks = chapters.map(chapter => {
  const playlistId = `${CAMPAIGN_ID}/${chapter.id}`
  const tracks = MUSIC_PLAYLISTS[playlistId] || []
  return { id: chapter.id, tracks: tracks.length, resolved: tracks.length >= 2 && tracks.length <= 3
    && tracks.every(trackId => tcuTracks.some(track => track.id === trackId)) }
})
const presentationAssets = {
  images: presentationImages.length,
  imagePaths: [...themeAssetPaths],
  tracks: tcuTracks.length,
  trackFiles: tcuTrackFiles.length,
  playlists: tcuPlaylistChecks,
  pass: presentationImages.length >= 10 && tcuTracks.length === 27
    && tcuTrackFiles.length === 27 && tcuPlaylistChecks.every(item => item.resolved),
}

// 开放玩家池（P10 · M5 全量开放）：83 张可入牌组的 05 卡进入构筑界面与 TCU 战役起始牌组池；
// 00–04 循环战役的自动牌组池保持原样（不因新卡池改变既有 replay/AI 产出）。
const deckableTcuCodes = TCU_PLAYER_BUILDABLE_CODES.filter(code => {
  const card = ALL_CARDS[code]
  return Boolean(card) && card.deckLimit !== 0 && ['asset', 'event', 'skill'].includes(card.type)
    && card.subtype !== 'weakness' && card.subtype !== 'basicweakness'
})
const deckBuilder = deckBuilderData()
const deckBuilderTcuCards = deckBuilder.cardPool.filter(card => /^05\d{3}$/.test(card.code))
const tcuCampaignPoolCodes = new Set(corePlayerPool({ campaign: { id: CAMPAIGN_ID } }).map(card => card.code))
const otherCampaignPoolCodes = new Set(corePlayerPool({ campaign: { id: 'nightOfTheZealot' } }).map(card => card.code))
const playerPoolOpen = {
  deckable: deckableTcuCodes.length,
  inDeckBuilder: deckBuilderTcuCards.length,
  inCampaignPool: deckableTcuCodes.filter(code => tcuCampaignPoolCodes.has(code)).length,
  absentFromOtherCampaigns: deckableTcuCodes.every(code => !otherCampaignPoolCodes.has(code)),
  pass: deckableTcuCodes.length === 83 && deckBuilderTcuCards.length === 83
    && deckableTcuCodes.every(code => tcuCampaignPoolCodes.has(code))
    && deckableTcuCodes.every(code => !otherCampaignPoolCodes.has(code)),
}

// 大厅可见：只列可启动战役；TCU 必须出现且带 9 章。
const hallCampaigns = campaignListForUi(contentRegistry)
const hallCampaign = hallCampaigns.find(item => item.id === CAMPAIGN_ID) || null
const lobbyVisible = Boolean(hallCampaign) && hallCampaign.status === 'playable'
  && hallCampaign.scenarios.length === 9

// 剧情（P9 · M3-C）

// P9 的证据口径与 P8 同构，全部由代码/实跑计算：
// - 生成物来自 A 的 tools/import-tcu-story.mjs（`--check` 实跑）与它生成的 story-text.js；
// - 幕间与战役流程来自 B 的 content/campaigns/theCircleUndone/manifest.js（validateCampaignGraph 校验）；
// - 行为验收来自 C 的 tests/tcu-story.test.mjs 实跑（导入一致性/分支互斥/幕间效果/隐私/旧存档）；
// - 任一输入暂缺时降级为 false + remaining；生成物缺失时 import 包在 catch 里，工具不会因并行开发爆炸。
const storyTextModule = await import('../content/campaigns/theCircleUndone/story-text.js').catch(() => null)
const storyText = storyTextModule?.TCU_STORY_TEXT ?? null
const tcuManifestModule = await import('../content/campaigns/theCircleUndone/manifest.js').catch(() => null)
const tcuManifest = tcuManifestModule?.manifest ?? null
const STORY_INTERLUDE_IDS = ['interludeOne', 'interludeTwo', 'interludeThree', 'interludeFour']
const STORY_FLOW_INTERLUDE_IDS = ['interludeTwo', 'interludeThree', 'interludeFour']
const STORY_EPILOGUE_KEYS = [
  'arrestedAnette', 'assumedControlOfTheLodge', 'survivedTheWatchersEmbrace',
  'signedTheBlackBook', 'youAreBeingHunted',
]

// 收集导入正文里的字符串（标题/标签也算），用于「非空」「无 HTML」两个机械判据。
const storyTexts = value => {
  if (typeof value === 'string') return value ? [value] : []
  if (Array.isArray(value)) return value.flatMap(storyTexts)
  if (value && typeof value === 'object') return Object.values(value).flatMap(storyTexts)
  return []
}
const storyHasText = value => {
  const texts = storyTexts(value)
  return texts.length > 0 && texts.every(text => text.trim().length > 0)
}
const storyHasHtml = value => storyTexts(value).some(text => /<[^>]+>/.test(text))
const storyClean = value => storyHasText(value) && !storyHasHtml(value)

// 生成器 --check 实跑；工具文件缺失时降级（不 spawn 一个必然失败的命令）。
const storyToolPresent = existsSync(new URL('../' + STORY_TOOL_PATH, import.meta.url))
const storyToolRun = storyToolPresent
  ? spawnSync(process.execPath, [STORY_TOOL_PATH, '--check'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', env: testEnv, timeout: 300_000,
  })
  : null
const storyGenerator = {
  command: `node ${STORY_TOOL_PATH} --check`,
  status: storyToolRun ? storyToolRun.status : null,
  missing: !storyToolPresent,
  ok: Boolean(storyToolRun && storyToolRun.status === 0),
}

// 剧情测试实跑：这是 P9 的行为证据（不接受 testSource.includes 式的字符串猜测）。
const storyTestPresent = existsSync(new URL('../' + STORY_TEST_PATH, import.meta.url))
const storyTestRun = storyTestPresent
  ? spawnSync(process.execPath, ['--test', STORY_TEST_PATH], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', env: testEnv, timeout: 300_000,
  })
  : null
const storyTestOutput = `${storyTestRun?.stdout || ''}\n${storyTestRun?.stderr || ''}`
const storyAcceptance = {
  command: `node --test ${STORY_TEST_PATH}`,
  status: storyTestRun ? storyTestRun.status : null,
  tests: numberFrom('tests', storyTestOutput),
  passed: numberFrom('pass', storyTestOutput),
  failed: numberFrom('fail', storyTestOutput),
  missing: !storyTestPresent,
  ok: Boolean(storyTestRun && storyTestRun.status === 0 && numberFrom('fail', storyTestOutput) === 0
    && numberFrom('pass', storyTestOutput) > 0),
}

// 逐章：introduction + 该章 scenario 定义里的每个 resolutions 键都要有导入正文，且不含 HTML。
const chapterItems = chapters.map(chapter => {
  const intro = storyText?.introductions?.[chapter.id] ?? null
  const resolutions = storyText?.resolutions?.[chapter.id] ?? null
  const resolutionKeys = Object.keys(contentRegistry.getScenarioData(chapter.id)?.resolutions || {})
  const missingResolutionKeys = resolutionKeys.filter(key => !storyHasText(resolutions?.[key]))
  const problems = []
  if (!storyText) problems.push(`缺少 ${STORY_TEXT_PATH}（生成器产物未就绪）`)
  else {
    if (!storyHasText(intro)) problems.push('缺少 introduction 正文')
    if (missingResolutionKeys.length) problems.push(`缺少 resolutions 正文：${missingResolutionKeys.join('、')}`)
  }
  const checks = {
    introImported: storyHasText(intro),
    resolutionsImported: resolutionKeys.length > 0 && missingResolutionKeys.length === 0,
    noHtml: storyClean(intro) && resolutionKeys.every(key => storyClean(resolutions?.[key])),
  }
  return {
    id: chapter.id,
    code: chapter.code,
    name: chapter.name,
    status: Object.values(checks).every(Boolean) ? 'verified' : 'pending',
    checks,
    problems,
    inventory: {
      resolutions: resolutionKeys.length,
      introTexts: storyTexts(intro).length,
      resolutionTexts: resolutionKeys.reduce((sum, key) => sum + storyTexts(resolutions?.[key]).length, 0),
    },
  }
})

// 序章：标题/正文 + 4 位故事调查员引言 + 22 条塔罗结果（arcana 0–21 全覆盖且正文非空）。
const storyPrologue = storyText?.prologue ?? null
const storyTarotResults = Object.values(storyPrologue?.tarotResults || {})
const storyTarotArcana = storyTarotResults.map(entry => entry?.arcana)
const prologueChecks = {
  title: typeof storyPrologue?.title === 'string' && storyPrologue.title.trim().length > 0,
  body: storyHasText(storyPrologue?.sections?.body),
  intro: storyHasText(storyPrologue?.sections?.intro),
  tarotResults: storyTarotResults.length === 22 && new Set(storyTarotArcana).size === 22
    && [...Array(22).keys()].every(arcana => storyTarotArcana.includes(arcana))
    && storyTarotResults.every(entry => typeof entry?.text === 'string' && entry.text.trim().length > 0),
  storyInvestigatorIntros: STORY_INVESTIGATOR_CODES.length === 4
    && STORY_INVESTIGATOR_CODES.every(code => storyHasText(storyPrologue?.storyInvestigatorIntros?.[code]?.paragraphs)),
}

// 4 段幕间：正文段落 + 标题；幕间二/三还要选择标签（refuse/agree/lie、truth/lie）。
const storyInterludes = storyText?.interludes || {}
const interludeItems = STORY_INTERLUDE_IDS.map(id => {
  const entry = storyInterludes[id] ?? null
  const labels = entry?.labels || null
  const expectedLabels = id === 'interludeTwo' ? ['refuse', 'agree', 'lie']
    : id === 'interludeThree' ? ['truth', 'lie'] : []
  const problems = []
  if (!storyText) problems.push(`缺少 ${STORY_TEXT_PATH}（生成器产物未就绪）`)
  else {
    if (!storyHasText(entry?.sections)) problems.push('缺少幕间正文段落')
    const missingLabels = expectedLabels.filter(key => !labels?.[key])
    if (missingLabels.length) problems.push(`缺少选择标签：${missingLabels.join('、')}`)
  }
  const checks = {
    imported: storyHasText(entry?.sections),
    title: typeof entry?.title === 'string' && entry.title.trim().length > 0,
    labels: expectedLabels.every(key => Boolean(labels?.[key])),
  }
  return {
    id,
    title: entry?.title ?? null,
    sections: Object.keys(entry?.sections || {}),
    labels: expectedLabels,
    checks,
    status: Object.values(checks).every(Boolean) ? 'verified' : 'pending',
    problems,
  }
})

// 尾声：标题 + 5 个记录片段（arrestedAnette / assumedControlOfTheLodge / survivedTheWatchersEmbrace /
// signedTheBlackBook / youAreBeingHunted）。
const storyEpilogue = storyText?.epilogue ?? null
const epilogueChecks = {
  title: typeof storyEpilogue?.title === 'string' && storyEpilogue.title.trim().length > 0,
  sections: STORY_EPILOGUE_KEYS.every(key => storyHasText(storyEpilogue?.sections?.[key])),
}

// 8 个战役结局：manifest.endings 逐条要有中文 label、已登记记录键、导入正文且无 HTML（不得再空）。
const storyEndings = Array.isArray(tcuManifest?.endings) ? tcuManifest.endings : []
const endingItems = storyEndings.map(ending => {
  const entry = storyText?.endings?.[ending.id] ?? null
  const problems = []
  if (!storyText) problems.push(`缺少 ${STORY_TEXT_PATH}（生成器产物未就绪）`)
  else if (!storyClean(entry?.paragraphs)) problems.push('缺少结局正文或正文含 HTML')
  if (typeof ending.label !== 'string' || !ending.label.length) problems.push('缺少中文 label')
  if (typeof ending.record !== 'string' || !ending.record.length) problems.push('缺少战役记录键')
  else if (!Object.hasOwn(recordTypes, ending.record)) problems.push(`记录键 ${ending.record} 未在 shared.js 登记`)
  const checks = {
    registered: typeof ending.label === 'string' && ending.label.length > 0
      && typeof ending.record === 'string' && ending.record.length > 0,
    textImported: storyClean(entry?.paragraphs),
    reachable: typeof ending.record === 'string' && Object.hasOwn(recordTypes, ending.record),
  }
  return {
    id: ending.id,
    label: ending.label ?? null,
    record: ending.record ?? null,
    paragraphs: storyTexts(entry?.paragraphs).length,
    source: entry?.source ?? null,
    checks,
    status: Object.values(checks).every(Boolean) ? 'verified' : 'pending',
    problems,
  }
})

// 战役流程：flow 存在 + validateCampaignGraph 通过 + 9 个 scenario 节点 + 3 个独立幕间 +
// 序章/尾声 story 节点 + end 节点。
let storyGraph = null
let storyFlowError = null
if (tcuManifest) {
  try {
    storyGraph = validateCampaignGraph(tcuManifest)
  } catch (error) {
    storyFlowError = error.message
  }
}
const storyNodeEntries = Object.entries(storyGraph?.nodes || {})
const storyStoryNodes = storyNodeEntries.filter(([, node]) => node.type === 'story').map(([id]) => id)
const flowChecks = {
  manifestFlow: Boolean(tcuManifest?.flow),
  graphValid: Boolean(storyGraph) && !storyFlowError,
  scenarioNodes: storyNodeEntries.filter(([, node]) => node.type === 'scenario').length === 9,
  interludeNodes: STORY_FLOW_INTERLUDE_IDS.every(id => storyGraph?.nodes?.[id]?.type === 'interlude'),
  prologueNode: storyStoryNodes.includes('prologue'),
  epilogueNode: storyStoryNodes.includes('epilogue'),
  endNode: storyGraph?.nodes?.end?.type === 'end',
}

// 私密正文：效果/视图/故事投影三处接线读点（行为由 C 的隐私用例背书），私密段不进 scenarioIntro。
const storyCampaignSource = readText(CAMPAIGN_VIEW_PATH) || ''
const storyEngineSource = readText(STORY_ENGINE_PATH) || ''
const storyEffectsSource = readText(STORY_EFFECTS_PATH) || ''
const privacyChecks = {
  privateStoryEffect: storyEffectsSource.includes("'privateStory'"),
  campaignViewFilters: storyCampaignSource.includes('privateStories')
    && storyCampaignSource.includes('audienceInvestigatorIds'),
  campaignStoryByObserver: storyEngineSource.includes('observerSeat') && storyEngineSource.includes('privateStories'),
}

const storyFallbacks = Array.isArray(storyText?.fallbacks) ? storyText.fallbacks : []
const storyChecks = {
  generator: storyGenerator.ok,
  nodeAcceptance: storyAcceptance.ok,
  chapters: chapterItems.length === 9 && chapterItems.every(item => item.status === 'verified'),
  prologue: Object.values(prologueChecks).every(Boolean),
  interludes: interludeItems.length === 4 && interludeItems.every(item => item.status === 'verified'),
  endings: endingItems.length >= 8 && endingItems.every(item => item.status === 'verified'),
  epilogue: Object.values(epilogueChecks).every(Boolean),
  flow: Object.values(flowChecks).every(Boolean),
  privacy: Object.values(privacyChecks).every(Boolean),
}
const storyStatus = Object.values(storyChecks).every(Boolean) ? 'verified' : 'pending'
const storyPendingChapters = chapterItems.filter(item => item.status !== 'verified')
const storyPendingInterludes = interludeItems.filter(item => item.status !== 'verified')
const storyPendingEndings = endingItems.filter(item => item.status !== 'verified')

// 显式近似（契约 §6）：按源码读点逐条计算后进 remaining，不静默通过、也不手写「已等价」。
const storyManifestSource = readText(CAMPAIGN_MANIFEST_PATH) || ''
const storyTextSource = readText(STORY_TEXT_PATH) || ''
const storyInterludeSource = readText(INTERLUDES_PATH) || ''
const storyApproximations = []
if (storyEngineSource.includes('SilverTwilight'))
  storyApproximations.push('幕间二 price1/price2 由在役调查员 traits 含 SilverTwilight 决定（Preston/Diana 可达）')
if (/expert\s*:\s*['"]?-6['"]?/.test(
  `${storyManifestSource}\n${storyInterludeSource}\n${storyEngineSource}\n${storyEffectsSource}`))
  storyApproximations.push('幕间四 twistOfFate 的 expert 混乱标记按参考代码 -6（卡面写 -7）')
if (storyEngineSource.includes('survivedTheWatchersEmbrace'))
  storyApproximations.push('尾声展示 survivedTheWatchersEmbrace 后不真正划掉该记录（留待 P10 复评）')
if (storyTextSource && !storyTextSource.includes('returnToResolution4'))
  storyApproximations.push('重返版（returnTo）内容不导入：D2 排除 returnToResolution4 与重返版占卜')
const scenarioApproximationTotal = scenarioItems.reduce((sum, item) => sum + (item.approximations?.length || 0), 0)
if (scenarioApproximationTotal)
  storyApproximations.push(`P8 已有的 ${scenarioApproximationTotal} 条 scenarioApproximations 继续有效（P9 不减少）`)

// ---------------------------------------------------------------- 机制登记与测试清单

const tcuMechanics = [...supportedMechanics].filter(id => id.startsWith('tcu')).sort()
const mechanicsItems = TCU_KEYWORDS.filter(keyword => keyword.ruleOwned)
  .map(keyword => ({
    id: keyword.ruleId,
    keyword: keyword.id,
    implemented: keyword.implemented !== false,
    registered: supportedMechanics.has(keyword.ruleId),
    evidence: RULES_TEST_PATH,
  }))
const mechanicsMismatches = mechanicsItems.filter(item => item.implemented !== item.registered).map(item => item.id)

const primitiveCatalog = readJson(PRIMITIVE_CATALOG_PATH)
// 只有 `new` 组有 status；`reuse` 组是引用既有原语，不需要完成态。
const newPrimitives = (primitiveCatalog?.primitives?.new || []).filter(Boolean)
const unfinishedPrimitives = newPrimitives.filter(item => item.status !== 'done').map(item => item.id || item.primitive || '(未命名)')
const primitiveCounts = { new: newPrimitives.length, done: newPrimitives.filter(item => item.status === 'done').length }

const testFiles = readdirSync(new URL('../tests/', import.meta.url))
  .filter(name => /^tcu-.*\.test\.mjs$/.test(name)).sort()
  .map(name => `tests/${name}`)
  .concat(existsSync(new URL('../' + BROWSER_SPEC_PATH, import.meta.url)) ? [BROWSER_SPEC_PATH] : [])
  .concat(existsSync(new URL('../' + INTERACTIONS_SPEC_PATH, import.meta.url)) ? [INTERACTIONS_SPEC_PATH] : [])
  .concat(existsSync(new URL('../' + SCENARIO_BROWSER_SPEC_PATH, import.meta.url)) ? [SCENARIO_BROWSER_SPEC_PATH] : [])

// ---------------------------------------------------------------- 门禁

const gate = {
  scopeLedger: { path: SCOPE_PATH, sha256: sha256(scopeBytes), pass: Boolean(scope?.gate?.pass) },
  records: {
    total: scope?.counts?.records ?? 0,
    assigned: (scope?.gate?.records?.assigned ?? 0),
    pass: scope?.counts?.records === 377 && scope?.gate?.records?.pass === true,
  },
  // P6：卡包按里程碑各自的状态。调查员包 M1 已 verified；P7 起玩家包 M2 也已 verified（87/87 + 85 可构筑）。
  packsByPhase: {
    investigators: {
      status: packs.find(pack => pack.id === 'tcuInvestigators')?.status ?? null,
      cards: packs.find(pack => pack.id === 'tcuInvestigators')?.cards ?? 0,
      implemented: packs.find(pack => pack.id === 'tcuInvestigators')?.rulesImplemented ?? 0,
    },
    campaign: {
      status: packs.find(pack => pack.id === 'tcuCampaign')?.status ?? null,
      cards: packs.find(pack => pack.id === 'tcuCampaign')?.cards ?? 0,
      implemented: packs.find(pack => pack.id === 'tcuCampaign')?.rulesImplemented ?? 0,
      pass: packs.find(pack => pack.id === 'tcuCampaign')?.status === 'playable'
        && packs.find(pack => pack.id === 'tcuCampaign')?.rulesImplemented === CAMPAIGN_CARD_CODES.length,
    },
    player: {
      status: playerPackInfo?.status ?? null,
      cards: playerPackInfo?.cards ?? 0,
      implemented: playerPackInfo?.rulesImplemented ?? 0,
      buildable: playerPackInfo?.deckbuildingOpen ?? 0,
      pass: playerPackInfo?.status === 'verified'
        && playerPackInfo?.rulesImplemented === 87
        && playerPackInfo?.deckbuildingOpen === 85,
    },
    pass: packs.find(pack => pack.id === 'tcuInvestigators')?.status === 'verified'
      && packs.find(pack => pack.id === 'tcuInvestigators')?.rulesImplemented === 19
      && packs.find(pack => pack.id === 'tcuCampaign')?.status === 'playable'
      && packs.find(pack => pack.id === 'tcuCampaign')?.rulesImplemented === CAMPAIGN_CARD_CODES.length
      && playerPackInfo?.status === 'verified'
      && playerPackInfo?.rulesImplemented === 87
      && playerPackInfo?.deckbuildingOpen === 85,
  },
  // P10：战役与 9 章从大厅开放（playable），assertLaunchable 必须通过；已不再有「仅图鉴」门禁。
  campaignLaunchable: {
    status: campaign?.status ?? null,
    chapters: scenarios.length,
    packIds: [...(campaign?.requiredPackIds || [])],
    launchable: !launchBlocked,
    lobbyVisible,
    pass: campaign?.status === 'playable' && scenarios.length === 9
      && !launchBlocked && lobbyVisible,
  },
  launchEnabled: { enabled: !launchBlocked, error: launchError, pass: !launchBlocked },
  // P10：9 章全部 playable 且每章通过注册表校验（章节可启动的前提）。
  chaptersLaunchable: {
    statuses: scenarios.map(scenario => `${scenario.id}:${scenario.status}`),
    pass: scenarios.length === 9 && scenarios.every(scenario =>
      ['playable', 'verified'].includes(scenario.status)),
  },
  encounterGroups: {
    expected: ENCOUNTER_GROUP_IDS.length,
    registered: packGroupIds.length,
    unique: new Set(packGroupIds).size === packGroupIds.length,
    missingChapterGroups,
    pass: packGroupIds.length === 21 && new Set(packGroupIds).size === 21 && missingChapterGroups.length === 0,
  },
  packCounts: {
    campaign: packs.find(pack => pack.id === 'tcuCampaign')?.cards ?? 0,
    investigators: packs.find(pack => pack.id === 'tcuInvestigators')?.cards ?? 0,
    player: packs.find(pack => pack.id === 'tcuPlayer')?.cards ?? 0,
    pass: !packCountMismatch,
  },
  requiredPacksExist: {
    packs: [...(campaign?.requiredPackIds || [])],
    pass: (campaign?.requiredPackIds || []).every(id => Boolean(contentRegistry.getPack(id))),
  },
  // P4：关键词与规则书。
  keywordScanAligned: { ...scanAlignment, pass: scanAlignment.pass },
  keywordsVerified: {
    total: keywordItems.length,
    verified: keywordItems.length - keywordFailures.length,
    pending: keywordFailures.map(item => item.id),
    pass: keywordFailures.length === 0 && keywordItems.length === TCU_SCANNED_KEYWORD_MECHANISMS.length,
  },
  rulebookEntries: {
    required: TCU_RULE_IDS.length,
    present: TCU_RULE_IDS.length - missingRuleEntries.length,
    missing: missingRuleEntries,
    orphan: orphanTcuRules,
    unindexed: unindexedRuleIds,
    badSortKeys,
    pass: missingRuleEntries.length === 0 && orphanTcuRules.length === 0
      && unindexedRuleIds.length === 0 && badSortKeys.length === 0,
  },
  rulebookVerified: {
    checks: rulebookChecks,
    pending: Object.entries(rulebookChecks).filter(([, value]) => !value).map(([key]) => key),
    pass: Object.values(rulebookChecks).every(Boolean),
  },
  nodeAcceptance: { ...nodeAcceptance, pass: nodeAcceptance.ok },
  mechanicsRegistered: {
    registered: tcuMechanics.length,
    mismatches: mechanicsMismatches,
    pass: mechanicsMismatches.length === 0,
  },
  // P5：11 条交互都有读点 + Node 验收 + 桌面/移动浏览器证据。
  interactionsVerified: {
    total: interactionItems.length,
    verified: interactionItems.length - interactionFailures.length,
    pending: interactionFailures.map(item => item.id),
    nodeAcceptance: interactionsAcceptance.ok,
    browser: { desktop: browserChecks.interactionsDesktop, mobile: browserChecks.interactionsMobile },
    pass: interactionFailures.length === 0 && interactionsAcceptance.ok && interactionsBrowserOk,
  },
  // P6：六位正式调查员 + 4 位故事调查员 + 13 张专属卡的逐人验收。
  investigatorsVerified: {
    formal: formalInvestigatorItems.length,
    selectable: formalInvestigatorItems.filter(item => item.checks.selectable).length,
    verified: formalInvestigatorItems.filter(item => item.status === 'verified').length,
    pending: formalPending.map(item => item.code),
    story: storyInvestigatorItems.length,
    storyPending: storyProblems.map(item => item.code),
    signatures: TCU_SIGNATURE_CODES.length,
    signaturesImplemented: TCU_SIGNATURE_CODES.filter(code => tcuInvestigatorCardVerified(code)).length,
    nodeAcceptance: investigatorAcceptance.ok,
    simplified: simplifiedCards.filter(item => !PLAYER_CARD_CODES.includes(item.code)).map(item => item.code),
    pass: investigatorsStatus === 'verified' && investigatorAcceptance.ok,
  },
  // P7：M2 玩家卡 87 张逐卡验收 + 85 张可构筑 + 2 张基础弱点只作依赖。
  playerCardsVerified: {
    total: playerItems.length,
    verified: playerItems.filter(item => item.status === 'verified').length,
    buildable: playerBuildable,
    basicWeaknesses: TCU_PLAYER_BASIC_WEAKNESS_CODES.length,
    pending: playerPending.map(item => item.code),
    nodeAcceptance: playerAcceptance.ok,
    ledgerTest: playerLedgerAcceptance.ok,
    testFiles: PLAYER_TEST_FILES,
    pass: playerStatus === 'verified',
  },
  // P8：9 章剧本逐章 12 项检查（来源锁/身份/区域/幕议程/地点/遭遇规则/逐卡/混乱/结局记录/正文/存档/浏览器）。
  scenariosVerified: {
    total: scenarioItems.length,
    development: scenarioItems.filter(item => ['development', 'verified'].includes(item.status)).length,
    verified: scenarioFullyVerified.length,
    nodeEvidence: scenarioNodeVerified.length,
    pending: scenarioPending.map(item => item.id),
    browserPending: scenarioBrowserPending.map(item => item.id),
    pendingEncounterCards: scenarioPendingCards,
    gaps: scenarioGapsCount,
    encounterCards: scenarioItems.reduce((sum, item) => sum + (item.inventory?.encounterCards || 0), 0),
    testFiles: scenarioTestFiles,
    ledger: { path: SCENARIO_ACCEPTANCE_LEDGER_PATH, sha256: sha256File(SCENARIO_ACCEPTANCE_LEDGER_PATH) },
    sourceLock: { path: SCENARIO_SOURCE_LOCK_PATH, sha256: sha256File(SCENARIO_SOURCE_LOCK_PATH) },
    nodeAcceptance: scenarioAcceptance.ok,
    ledgerTest: scenarioLedgerAcceptance.ok,
    // P10：9 章 12 项检查全真（含 P8 逐章实机浏览器）；章节状态 playable 由 12 项 + 注册期校验共同成立。
    pass: scenarioStatusVerified === 'verified' && scenarioAcceptance.ok && scenarioLedgerAcceptance.ok
      && scenarioPendingCards === 0
      && scenarios.every(scenario => ['playable', 'verified'].includes(scenario.status)),
  },
  // P10：377 条印刷记录逐卡验收——证据全部来自实跑测试文件，未验收必须为 0。
  allCardsVerified: {
    total: allCardsEntries.length,
    records: allCardsRecordCount,
    faces: allCardsFaceCount,
    verified: allCardsVerifiedCodes.length,
    pending: allCardsPendingCodes.length,
    pendingCodes: allCardsPendingCodes,
    partitions: allCardsPartitions,
    tool: allCardsTool,
    summary: allCardsSummary,
    ledger: { path: ALL_CARDS_LEDGER_PATH, sha256: sha256File(ALL_CARDS_LEDGER_PATH) },
    module: { path: ALL_CARDS_MODULE_PATH, sha256: sha256File(ALL_CARDS_MODULE_PATH) },
    badEvidence: allCardsBadEvidence,
    // 逐卡备注（来自 P10 行为审计的 approximation/gap）单独计数：状态仍是 verified（自动测试通过），
    // 但 noteStatus=simplified 的卡不宣称与印刷规则完全一致，逐条进 remaining。
    simplified: allCardsSummary?.simplified ?? 0,
    pass: allCardsStatus === 'verified',
  },
  // P10：发布级实机浏览器证据（大厅→序章→章节）+ 资源可访问性；由 runner 生成，不手写。
  releaseBrowser: {
    report: { path: BROWSER_PATH, generatedBy: browserReport?.generatedBy ?? null, status: browserReport?.status ?? null },
    release: { desktop: releaseBrowserChecks.releaseDesktop, mobile: releaseBrowserChecks.releaseMobile },
    media: { desktop: releaseBrowserChecks.mediaDesktop, mobile: releaseBrowserChecks.mediaMobile },
    specs: releaseBrowserChecks.specs,
    expectedSpecs: requiredBrowserSpecs,
    pass: releaseBrowserStatus === 'verified',
  },
  // P10：展示素材（图片 + 27 首 BGM + 每章歌单）实际落盘。
  presentationAssets: {
    images: presentationAssets.images,
    tracks: presentationAssets.tracks,
    trackFiles: presentationAssets.trackFiles,
    playlists: presentationAssets.playlists,
    pass: presentationAssets.pass,
  },
  // P10：开放玩家池——83 张 05 可入牌组卡进入构筑界面与 TCU 战役起始牌组池；其它战役不变。
  playerPoolOpen: { ...playerPoolOpen },
  // P10：逐卡行为审计覆盖（377 条记录逐条核对；gap/approximation 计入 remaining，不冒充全匹配）。
  cardBehaviorAudit: { ...cardBehaviorAudit },
  // P10 发布门禁：大厅可启动 + 逐卡自动账本 + 逐卡行为审计覆盖 + 发布实机浏览器 + 展示素材 + 开放玩家池。
  releaseGate: {
    launch: !launchBlocked && campaign?.status === 'playable',
    lobby: lobbyVisible,
    allCards: allCardsStatus === 'verified',
    cardBehaviorAudit: cardBehaviorComplete,
    releaseBrowser: releaseBrowserStatus === 'verified',
    presentation: presentationAssets.pass,
    playerPool: playerPoolOpen.pass,
    pass: !launchBlocked && campaign?.status === 'playable' && lobbyVisible
      && allCardsStatus === 'verified' && cardBehaviorComplete
      && releaseBrowserStatus === 'verified' && presentationAssets.pass && playerPoolOpen.pass,
  },

  // P9：M3-C 剧情——9 章导入正文、序章（4 引言 + 22 塔罗）、4 幕间、8 结局、尾声、
  // flow 节点链与私密投影；生成器与剧情测试都实跑取退出码。
  storyVerified: {
    chapters: chapterItems.length,
    verified: chapterItems.filter(item => item.status === 'verified').length,
    endings: endingItems.length,
    interludes: interludeItems.length,
    flowNodes: storyNodeEntries.length,
    generator: storyGenerator.ok,
    nodeAcceptance: storyAcceptance.ok,
    pass: storyStatus === 'verified',
  },
  // 第 2 步的原语快照（worker 只读同一份 catalog）：账本只读不写，完成态由 audit:tcu:primitives 负责。
  primitivesDone: {
    new: primitiveCounts.new,
    done: primitiveCounts.done,
    unfinished: unfinishedPrimitives,
    pass: primitiveCounts.new > 0 && primitiveCounts.done === primitiveCounts.new,
  },
}
const pass = Object.values(gate).every(entry => entry.pass)

// ---------------------------------------------------------------- remaining（算出来，不手写）

const remaining = []
if (keywordFailures.length) remaining.push(`关键词未 verified：${keywordFailures.map(item => `${item.id}（${item.problems.join('；')}）`).join(' | ')}`)
if (rulebookStatus !== 'verified') {
  const pendingChecks = Object.entries(rulebookChecks).filter(([, value]) => !value).map(([key]) => key)
  remaining.push(`规则书未 verified：${pendingChecks.join('、')}${browserChecks.reportPresent ? '' : '（缺 audit/tcu-browser-acceptance.json：先跑 npm run test:tcu:rules:browser）'}`)
}
const catalogChapters = scenarios.filter(scenario => scenario.status === 'catalog-only').length
if (catalogChapters) remaining.push(`${catalogChapters} 章仍是 catalog-only（P8 剧本）：逐章 12 项验收尚未建立`)
if (scenarioStatus !== 'development') {
  remaining.push(`P8 剧本未达到 development：${scenarioPending.map(item => `${item.id}（${Object.entries(item.checks || {}).filter(([, value]) => !value).map(([key]) => key).join('、') || '账本缺失'}）`).join(' | ') || '账本缺失'}`)
}
if (scenarioPendingCards) remaining.push(`${scenarioPendingCards} 张战役遭遇卡仍缺单卡条目实现（P8 逐章验收）`)
for (const item of scenarioItems) {
  for (const gap of item.gaps || []) remaining.push(`P8 显式简化：${item.id}——${gap}`)
}
if (scenarioBrowserPending.length) {
  remaining.push(`P8 实机浏览器证据待补：${scenarioBrowserPending.map(item => item.id).join('、')}（node tools/playwright-tcu-reporter.mjs，tests/tcu-scenarios.browser.mjs）`)
}
if (!scenarioAcceptance.ok) remaining.push(`P8 逐章账本工具未通过：node ${SCENARIO_ACCEPTANCE_TOOL_PATH} --write/--check`)
if (!scenarioLedgerAcceptance.ok) remaining.push(`P8 逐章账本测试未通过：node --test ${SCENARIO_LEDGER_TEST_PATH}`)

// P9：剧情正文/幕间/结局/尾声/流程/隐私的未完成项 + 显式回退与显式近似，全部由上面的计算得出。
if (!storyText) remaining.push(`P9 剧情正文未导入：${STORY_TEXT_PATH} 缺失（先跑 node ${STORY_TOOL_PATH} --write）`)
if (storyStatus !== 'verified') {
  const failedStoryChecks = Object.entries(storyChecks).filter(([, value]) => !value).map(([key]) => key)
  remaining.push(`P9 剧情未 verified：${failedStoryChecks.join('、')}`)
}
if (!storyGenerator.ok) remaining.push(`P9 剧情生成器 --check 未通过：node ${STORY_TOOL_PATH} --check${storyGenerator.missing ? '（工具尚未交付）' : ''}`)
if (!storyAcceptance.ok) remaining.push(`P9 剧情测试未通过：node --test ${STORY_TEST_PATH}${storyAcceptance.missing ? '（测试文件尚未交付）' : ''}`)
for (const item of storyPendingChapters) {
  if (storyText) remaining.push(`P9 章节正文未完成：${item.id}（${item.problems.join('；') || '检查未通过'}）`)
}
for (const item of storyPendingInterludes) {
  if (storyText) remaining.push(`P9 幕间未完成：${item.id}（${item.problems.join('；') || '检查未通过'}）`)
}
for (const item of storyPendingEndings) {
  if (storyText) remaining.push(`P9 结局正文未完成：${item.id}（${item.problems.join('；') || '检查未通过'}）`)
}
if (endingItems.length < 8) remaining.push(`P9 战役结局只登记 ${endingItems.length} 条（应为 8 条：补 lodgeHoldsTheWorld）`)
if (!Object.values(prologueChecks).every(Boolean)) {
  remaining.push(`P9 序章正文未完成：${Object.entries(prologueChecks).filter(([, value]) => !value).map(([key]) => key).join('、')}`)
}
if (!Object.values(epilogueChecks).every(Boolean)) {
  remaining.push(`P9 尾声正文未完成：${Object.entries(epilogueChecks).filter(([, value]) => !value).map(([key]) => key).join('、')}`)
}
if (!flowChecks.manifestFlow) remaining.push(`P9 战役流程未接线：${CAMPAIGN_MANIFEST_PATH} 的 flow 仍为空`)
if (storyFlowError) remaining.push(`P9 战役流程校验失败：${storyFlowError}`)
if (!Object.values(privacyChecks).every(Boolean)) {
  remaining.push(`P9 私密正文投影未接通：${Object.entries(privacyChecks).filter(([, value]) => !value).map(([key]) => key).join('、')}`)
}
for (const fallback of storyFallbacks) remaining.push(`P9 显式回退：${fallback.id}——${fallback.reason}`)
for (const note of storyApproximations) remaining.push(`P9 显式近似：${note}`)

if (formalPending.length) {
  remaining.push(`调查员未 verified：${formalPending.map(item => `${item.code}（${item.problems.join('；') || '检查未通过'}）`).join(' | ')}`)
}
if (storyProblems.length) remaining.push(`序章故事调查员未 verified：${storyProblems.map(item => `${item.code}（${item.problems.join('、')}）`).join(' | ')}`)
for (const item of simplifiedCards) {
  remaining.push(`显式简化：${item.code} ${item.name}${item.note ? `——${item.note}` : '（未写 note）'}`)
}
const unimplementedCampaign = (packs.find(pack => pack.id === 'tcuCampaign')?.cards ?? 0)
  - (packs.find(pack => pack.id === 'tcuCampaign')?.rulesImplemented ?? 0)
if (unimplementedCampaign) remaining.push(`${unimplementedCampaign} 张战役卡没有单卡行为：M3（P8）逐章验收`)
// P7：玩家卡不再有「没有单卡行为」的遗留；未 verified 的逐卡、验收工具与账本测试分别列明。
if (playerPending.length) remaining.push(`M2 玩家卡未 verified：${playerPending.map(item => item.code).join('、')}`)
if (!playerAcceptance.ok) remaining.push(`M2 玩家卡验收工具未通过：node ${PLAYER_ACCEPTANCE_TOOL_PATH}（实跑 4 个分片测试并逐字节比对账本/模块）`)
if (!playerLedgerAcceptance.ok) remaining.push(`M2 玩家卡账本测试未通过：node --test ${PLAYER_LEDGER_TEST_PATH}`)
if (!recordTypes || Object.keys(recordTypes).length < 64) remaining.push(`战役记录只登记 ${Object.keys(recordTypes).length} 个键（参考实现 64 个）：其余键、中文名与幕间结算属 P9`)
if (mechanicsMismatches.length) remaining.push(`机制登记与关键词表不一致：${mechanicsMismatches.join('、')}`)
if (interactionFailures.length) remaining.push(`交互面板未 verified：${interactionFailures.map(item => `${item.id}（${item.problems.join('；') || '缺少浏览器证据'}）`).join(' | ')}`)
if (!browserChecks.reportPresent) remaining.push('浏览器证据缺失：桌面 1440 / 移动 390 的规则书与交互用例必须由 tests/tcu-*.browser.mjs 的 runner 生成')
// 交互的实机路径：P8 章节可达后由 tests/tcu-scenarios.browser.mjs 的 runner 在真实剧本路径上补跑。
if (scenarioBrowserPending.length) remaining.push(`交互/剧本实机路径待补浏览器验收：${scenarioBrowserPending.length} 章的 desktop/mobile 实机用例尚未生成`)
if (unfinishedPrimitives.length) remaining.push(`未完成原语：${unfinishedPrimitives.join('、')}`)

// P10：发布级事实的未完成项（逐卡账本、发布浏览器、展示素材、玩家池、大厅）。
// 全部由上面同一批计算得出；任何一项为 false 都会进入 remaining，而不是在文档里写成「已完成」。
if (!allCardsTool.ok) remaining.push(`P10 逐卡账本工具未通过：node ${ALL_CARDS_TOOL_PATH} --check（实跑 6 个逐卡测试并逐字节比对账本/模块）`)
if (!allCardsEntries.length) {
  remaining.push(`P10 逐卡账本缺失：${ALL_CARDS_LEDGER_PATH}（先跑 node ${ALL_CARDS_TOOL_PATH} --write）`)
} else if (allCardsStatus !== 'verified') {
  remaining.push(`P10 逐卡账本未 verified：${allCardsPendingCodes.length
    ? `未验收 ${allCardsPendingCodes.length} 条（${allCardsPendingCodes.join('、')}）`
    : `记录 ${allCardsEntries.length} / 分区 ${JSON.stringify(allCardsPartitions)} / 证据问题 ${allCardsBadEvidence.length} 条`}`)
}
if (releaseBrowserStatus !== 'verified') {
  remaining.push(`P10 发布级浏览器证据未 verified：${Object.entries(releaseBrowserChecks)
    .filter(([key, value]) => key !== 'specs' && !value).map(([key]) => key).join('、') || 'spec 集合不齐'}`
    + '（证据命令：npx playwright test --config playwright.tcu.config.mjs tcu-rules.browser.mjs '
    + 'tcu-interactions.browser.mjs tcu-scenarios.browser.mjs tcu-release.browser.mjs tcu-media.browser.mjs）')
}
if (!presentationAssets.pass) {
  remaining.push(`P10 展示素材不完整：图片 ${presentationAssets.images}/10、BGM 文件 ${presentationAssets.trackFiles}/27、`
    + `每章歌单 ${presentationAssets.playlists.filter(item => item.resolved).length}/9`)
}
if (!playerPoolOpen.pass) {
  remaining.push(`P10 开放玩家池未通过：可入牌组 ${playerPoolOpen.deckable}/83、构筑界面 ${playerPoolOpen.inDeckBuilder}/83、`
    + `TCU 战役池 ${playerPoolOpen.inCampaignPool}/83、其它战役误入 ${playerPoolOpen.absentFromOtherCampaigns ? '0' : '有'}`)
}
if (!lobbyVisible) remaining.push('P10 大厅入口未出现《万象无终》或章节数不为 9')
if (campaign?.status !== 'playable') remaining.push(`P10 战役状态 ${campaign?.status} 不是 playable`)

// P10 逐卡行为审计：未覆盖时进 remaining；发现的未实现子句（gap）逐卡列出（earlyAccess 的口径来源），
// 显式近似（approximation）给出逐卡账本指针与数量，不在文档里冒充「完全匹配」。
if (!cardBehaviorAudit.pass) {
  remaining.push(`P10 逐卡行为审计未覆盖 377 条记录：实际 ${cardBehaviorAudit.total} 条`
    + `（主卡 ${cardBehaviorAudit.mainCards}/343、关联面 ${cardBehaviorAudit.faces}/34）——`
    + `先按 develop/p10-card-audit-batches.mjs 分批核对并运行 node develop/p10-card-audit-ledger.mjs --write`)
}
if (cardBehaviorGaps.length) {
  remaining.push(`P10 逐卡行为缺口（未实现子句，${cardBehaviorGaps.length} 张卡）：发布口径按 earlyAccess，`
    + `逐卡差异见 ${CARD_BEHAVIOR_LEDGER_PATH}`)
  for (const entry of cardBehaviorGaps) {
    remaining.push(`P10 卡面未实现：${entry.code} ${entry.name}——${String(entry.note || '见逐卡账本').slice(0, 240)}`)
  }
}
if (cardBehaviorApproximations.length) {
  remaining.push(`P10 逐卡显式近似（行为等价但非逐条实现，${cardBehaviorApproximations.length} 张卡）：`
    + cardBehaviorApproximations.map(entry => entry.code).join('、'))
}

// P10 发布口径（不是「未完成」，而是发布时必须如实说明的边界；任何一条都不能写成「规则等价」）。
remaining.push('P10 发布口径：占位美术——web/img/campaigns/theCircleUndone 为确定性 ffmpeg 生成图（非官方美术），'
  + '后续同名替换并更新 assets.json，不改装备局')
remaining.push('P10 发布口径：自动构筑只在《万象无终》战役追加 83 张 05 卡；其它循环战役保持既有自动牌组产出'
  + '（golden replay/AI 零变化），手动构筑与关间升级按卡牌范围与记录开放')
remaining.push('P10 发布口径：三组确认按 P8/P9 口径 verified；逐卡行为审计仍发现 gap/approximation，'
  + '因此按 earlyAccess 发布（equivalenceCertified=false），不宣称与印刷规则完全等价')
if (!remaining.length) remaining.push('P10 发布范围内无遗留')

// ---------------------------------------------------------------- 发布确认（P10 · M5）

// 三组确认之外的发布级事实：大厅可启动、逐卡账本、展示素材、开放玩家池、实机浏览器。
// 全部由上面的计算派生，不手写「全真」。
const releaseChecks = {
  launchable: !launchBlocked && campaign?.status === 'playable',
  lobby: lobbyVisible,
  allCards: allCardsStatus === 'verified',
  presentation: presentationAssets.pass,
  playerPool: playerPoolOpen.pass,
  releaseDesktopBrowser: releaseBrowserChecks.releaseDesktop,
  releaseMobileBrowser: releaseBrowserChecks.releaseMobile,
  mediaDesktop: releaseBrowserChecks.mediaDesktop,
  mediaMobile: releaseBrowserChecks.mediaMobile,
}
const releaseStatus = Object.values(releaseChecks).every(Boolean) ? 'verified' : 'pending'

// ---------------------------------------------------------------- 账本

const audit = {
  schemaVersion: 2,
  cycle: 'tcu',
  cycleNameZh: '万象无终',
  milestone: 'P10',
  stage: '第 6 步：测试与验收 · M5 发布',
  generatedBy: 'tools/audit-tcu.mjs',
  docs: 'docs/tcu-migration-roadmap.md',
  scope: { path: SCOPE_PATH, sha256: gate.scopeLedger.sha256 },
  campaign: {
    id: CAMPAIGN_ID,
    status: campaign?.status ?? null,
    name: campaign?.name ?? null,
    nameEn: campaign?.nameEn ?? null,
    chapters: chapters.length,
    requiredPackIds: [...(campaign?.requiredPackIds || [])],
    launchBlocked,
    launchError,
    lobbyVisible,
  },
  status: campaign?.status ?? null,
  playable: LAUNCHABLE.has(campaign?.status) && !launchBlocked,
  launchEnabled: !launchBlocked,
  // P10 逐卡行为审计发现未实现子句（gap）时，发布口径按路线图 §8.4 的 earlyAccess 退路：
  // playable + earlyAccess + equivalenceCertified=false + 完整 remaining；不得描述为规则等价。
  // 2026-10-25 第七轮：gap 已清零，但仍有显式近似（approximation）→ 仍按 earlyAccess 发布，不宣称等价。
  earlyAccess: cardBehaviorGaps.length > 0 || cardBehaviorApproximations.length > 0,
  earlyAccessReason: (cardBehaviorGaps.length > 0 || cardBehaviorApproximations.length > 0)
    ? `逐卡行为审计发现 ${cardBehaviorGaps.length} 张卡存在未实现子句（gap）、`
      + `${cardBehaviorApproximations.length} 张为显式近似；三组确认按 P8/P9 口径 verified，`
      + '但不等价于印刷规则，故按 earlyAccess 发布并逐条列入 remaining。'
    : null,
  equivalenceCertified: false,
  verifiedScope: {
    milestone: 'P4–P10',
    keywords: keywordsStatus === 'verified',
    rulebook: rulebookStatus === 'verified',
    interactions: interactionsStatus === 'verified',
    investigators: investigatorsStatus === 'verified',
    scenarios: scenarioStatusVerified === 'verified',
    playerCards: playerStatus === 'verified',
    story: storyStatus === 'verified',
    allCards: allCardsStatus === 'verified',
    cardBehaviorAudit: cardBehaviorGaps.length === 0 && cardBehaviorComplete,
    launch: !launchBlocked && campaign?.status === 'playable' && lobbyVisible,
    presentation: presentationAssets.pass,
    releaseBrowser: releaseBrowserStatus === 'verified',
  },
  packs,
  scenarios,
  chapters: chapterChecks,
  encounterGroups: [...ENCOUNTER_GROUP_IDS],
  counts: scope.counts,
  chaosBags: Object.fromEntries(Object.entries(CHAOS_BAGS).map(([difficulty, bag]) => [difficulty, { tokens: bag.length, skulls: bag.filter(token => token === 'skull').length }])),
  recordSchema: Object.fromEntries(Object.entries(recordTypes).sort(([a], [b]) => (a < b ? -1 : 1))),
  investigatorCodes: [...INVESTIGATOR_CODES],
  storyInvestigatorCodes: [...STORY_INVESTIGATOR_CODES],
  mechanics: { status: mechanicsMismatches.length ? 'pending' : 'verified', items: mechanicsItems },
  primitives: { ...primitiveCounts, unfinished: unfinishedPrimitives },
  sources: scope.sources,
  confirmations: {
    // P8：9 章剧本逐章 12 项检查——账本由 tools/audit-tcu-scenarios.mjs 从代码与实跑证据计算。
    scenarios: {
      status: scenarioStatusVerified === 'verified' ? 'verified' : scenarioStatus,
      milestone: 'M3',
      chapters: scenarioItems.length,
      checks: {
        sourceLocked: scenarioItems.every(item => item.checks?.sourceLocked === true),
        identityRegistered: scenarioItems.every(item => item.checks?.identityRegistered === true),
        setupAndZones: scenarioItems.every(item => item.checks?.setupAndZones === true),
        actsAndAgendas: scenarioItems.every(item => item.checks?.actsAndAgendas === true),
        locationsAndConnections: scenarioItems.every(item => item.checks?.locationsAndConnections === true),
        encounterBehaviors: scenarioItems.every(item => item.checks?.encounterBehaviors === true),
        literalCardBehavior: scenarioItems.every(item => item.checks?.literalCardBehavior === true),
        chaosEffects: scenarioItems.every(item => item.checks?.chaosEffects === true),
        resolutionsAndRecords: scenarioItems.every(item => item.checks?.resolutionsAndRecords === true),
        storyText: scenarioItems.every(item => item.checks?.storyText === true),
        saveReplay: scenarioItems.every(item => item.checks?.saveReplay === true),
        browserAcceptance: scenarioItems.every(item => item.checks?.browserAcceptance === true),
        nodeAcceptance: scenarioAcceptance.ok,
        ledgerTest: scenarioLedgerAcceptance.ok,
      },
      items: scenarioItems.map(item => ({
        id: item.id,
        code: item.code,
        name: item.name,
        status: item.status,
        checks: item.checks,
        inventory: item.inventory,
        gaps: item.gaps,
        pendingEncounterCodes: item.pendingEncounterCodes,
        testFile: item.testFile,
      })),
      ledger: { path: SCENARIO_ACCEPTANCE_LEDGER_PATH, sha256: sha256File(SCENARIO_ACCEPTANCE_LEDGER_PATH) },
      sourceLock: { path: SCENARIO_SOURCE_LOCK_PATH, sha256: sha256File(SCENARIO_SOURCE_LOCK_PATH) },
      evidence: [
        SCENARIO_ACCEPTANCE_TOOL_PATH, SCENARIO_ACCEPTANCE_LEDGER_PATH,
        SCENARIO_SOURCE_LOCK_PATH, SCENARIO_LEDGER_TEST_PATH,
        ...scenarioTestFiles, SCENARIO_BROWSER_SPEC_PATH,
      ],
    },
    // P9：M3-C 剧情——导入正文（9 章 × 全部 resolutions）、序章（4 引言 + 22 塔罗）、
    // 4 段幕间、8 个结局、尾声、manifest.flow 节点链与座位级私密投影；生成器/测试均实跑。
    story: {
      status: storyStatus,
      milestone: 'M3-C',
      checks: storyChecks,
      items: chapterItems,
      prologue: prologueChecks,
      interludes: interludeItems,
      endings: endingItems,
      epilogue: epilogueChecks,
      flow: {
        status: Object.values(flowChecks).every(Boolean) ? 'verified' : 'pending',
        checks: flowChecks,
        nodes: storyNodeEntries.length,
        scenarios: storyNodeEntries.filter(([, node]) => node.type === 'scenario').length,
        storyNodes: storyStoryNodes,
        interludes: storyNodeEntries.filter(([, node]) => node.type === 'interlude').map(([id]) => id),
        error: storyFlowError,
      },
      privacy: {
        status: Object.values(privacyChecks).every(Boolean) ? 'verified' : 'pending',
        checks: privacyChecks,
      },
      fallbacks: storyFallbacks,
      approximations: storyApproximations,
      evidence: [
        STORY_TOOL_PATH, STORY_TEXT_PATH, STORY_TEST_PATH, INTERLUDES_PATH, CAMPAIGN_MANIFEST_PATH,
        STORY_ENGINE_PATH, STORY_EFFECTS_PATH, CAMPAIGN_VIEW_PATH, 'src/campaign/campaign-flow.js',
      ],
    },
    keywords: {
      status: keywordsStatus,
      items: keywordItems,
    },
    rulebook: {
      status: rulebookStatus,
      requiredRuleIds: [...TCU_RULE_IDS],
      checks: rulebookChecks,
      details: {
        campaignOverview: campaignOverviewChecks,
        scenarioMechanics: scenarioMechanicsChecks,
        keywordEntries: keywordEntriesChecks,
        cardLinks: cardLinksChecks,
        browser: browserChecks,
      },
      evidence: [RULEBOOK_PATH, UI_CARDS_PATH, KEYWORDS_PATH, RULES_TEST_PATH, BROWSER_SPEC_PATH, BROWSER_PATH],
    },
    // P5：11 条交互的读点、Node 验收与桌面/移动浏览器证据。
    interactions: {
      status: interactionsStatus,
      checks: {
        desktopBrowser: browserChecks.interactionsDesktop,
        mobileBrowser: browserChecks.interactionsMobile,
        nodeAcceptance: interactionsAcceptance.ok,
      },
      items: interactionItems,
      evidence: [INTERACTIONS_UI_PATH, INTERACTIONS_CSS_PATH, INTERACTIONS_TEST_PATH, INTERACTIONS_SPEC_PATH, BROWSER_PATH],
    },
    // P6：M1 调查员的逐人验收（正式 6 位 + 故事 4 位 + 13 张专属卡）。
    investigators: {
      status: investigatorsStatus,
      checks: {
        formalSelectable: formalInvestigatorItems.every(item => item.checks.selectable),
        deckbuildingOpen: formalInvestigatorItems.every(item => item.checks.deckbuildingOpen),
        entriesRegistered: formalInvestigatorItems.every(item => item.checks.dataDeclared),
        signaturesImplemented: TCU_SIGNATURE_CODES.every(code => tcuInvestigatorCardVerified(code)),
        ruleDataValid: formalInvestigatorItems.every(item => item.checks.ruleDataValid),
        deckContracts: formalInvestigatorItems.every(item => item.checks.deckContract),
        storyInvestigators: storyProblems.length === 0,
        nodeAcceptance: investigatorAcceptance.ok,
      },
      items: formalInvestigatorItems,
      storyItems: storyInvestigatorItems,
      simplified: simplifiedCards.filter(item => !PLAYER_CARD_CODES.includes(item.code)),
      evidence: [INVESTIGATOR_PACK_PATH, INVESTIGATOR_TEST_PATH, ...INVESTIGATOR_HELPERS],
    },
    // P7：M2 玩家卡 87 张逐卡验收（4 个分片测试实跑 + 账本/生成模块逐字节复算 + availability/campaign 接线）。
    playerCards: {
      status: playerStatus,
      total: playerItems.length,
      constructible: playerBuildable,
      basicWeaknesses: TCU_PLAYER_BASIC_WEAKNESS_CODES.length,
      checks: {
        printedEffects: playerItems.every(item => item.checks.printedEffects),
        packaged: playerItems.every(item => item.checks.packaged),
        availabilityGate: playerItems.every(item => item.checks.availability),
        deckbuildingGate: playerItems.every(item => item.checks.deckbuilding),
        dependencyOnlyGate: playerItems.every(item => item.checks.dependencyOnly),
        nodeAcceptance: playerAcceptance.ok,
        ledgerFresh: playerAcceptance.ok,
        ledgerTest: playerLedgerAcceptance.ok,
        buildable85: playerBuildable === TCU_PLAYER_BUILDABLE_CODES.length && playerBuildable === 85,
      },
      items: playerItems,
      simplified: simplifiedCards.filter(item => PLAYER_CARD_CODES.includes(item.code)),
      ledger: { path: PLAYER_ACCEPTANCE_LEDGER_PATH, sha256: sha256File(PLAYER_ACCEPTANCE_LEDGER_PATH) },
      generatedModule: { path: PLAYER_ACCEPTANCE_MODULE_PATH, sha256: sha256File(PLAYER_ACCEPTANCE_MODULE_PATH) },
      evidence: [
        PLAYER_PACK_PATH, AVAILABILITY_PATH, CAMPAIGN_PATH, PLAYER_ACCEPTANCE_TOOL_PATH,
        PLAYER_ACCEPTANCE_LEDGER_PATH, PLAYER_ACCEPTANCE_MODULE_PATH,
        ...PLAYER_TEST_FILES, PLAYER_LEDGER_TEST_PATH,
      ],
    },
    // P10：M5 发布——逐卡账本（377 条记录）、大厅→序章→章节实机浏览器、展示素材与开放玩家池；
    // 全部由工具实跑/读盘计算，这里只做分组呈现。
    release: {
      status: releaseStatus,
      milestone: 'M5',
      checks: releaseChecks,
      allCards: {
        total: allCardsEntries.length,
        records: allCardsRecordCount,
        faces: allCardsFaceCount,
        verified: allCardsVerifiedCodes.length,
        pending: allCardsPendingCodes.length,
        partitions: allCardsPartitions,
        summary: allCardsSummary,
        ledger: { path: ALL_CARDS_LEDGER_PATH, sha256: sha256File(ALL_CARDS_LEDGER_PATH) },
        module: { path: ALL_CARDS_MODULE_PATH, sha256: sha256File(ALL_CARDS_MODULE_PATH) },
      },
      browser: {
        report: { path: BROWSER_PATH, generatedBy: browserReport?.generatedBy ?? null, status: browserReport?.status ?? null },
        specs: releaseBrowserChecks.specs,
        release: { desktop: releaseBrowserChecks.releaseDesktop, mobile: releaseBrowserChecks.releaseMobile },
        media: { desktop: releaseBrowserChecks.mediaDesktop, mobile: releaseBrowserChecks.mediaMobile },
      },
      presentation: presentationAssets,
      playerPool: playerPoolOpen,
      evidence: [
        ALL_CARDS_TOOL_PATH, ALL_CARDS_LEDGER_PATH, ALL_CARDS_MODULE_PATH, ALL_CARDS_TEST_PATH,
        CARD_FIDELITY_TEST_PATH, CARD_NOTES_PATH, CARD_BEHAVIOR_LEDGER_PATH,
        RELEASE_SPEC_PATH, MEDIA_SPEC_PATH,
        PRESENTATION_PATH, MUSIC_PLAYER_PATH, MUSIC_PLAYLIST_PATH, MUSIC_SOURCES_PATH,
        BROWSER_PATH, INVESTIGATOR_TEST_PATH, ...PLAYER_TEST_FILES,
      ],
    },
    // P10：逐卡行为审计（卡面印刷描述 vs 实现）。自动测试证据在 allCards 确认组里；
    // 这里记录的是逐条人工/代理核对后的 match/approximation/gap 分布与逐卡明细文件。
    cardBehavior: {
      status: cardBehaviorAudit.pass && cardBehaviorGaps.length === 0 ? 'verified' : 'pending',
      milestone: 'M5',
      covered: cardBehaviorAudit.pass,
      counts: {
        total: cardBehaviorAudit.total,
        mainCards: cardBehaviorAudit.mainCards,
        faces: cardBehaviorAudit.faces,
        match: cardBehaviorAudit.match,
        approximation: cardBehaviorAudit.approximation,
        gap: cardBehaviorAudit.gap,
        notApplicable: cardBehaviorAudit.notApplicable,
      },
      gapCodes: cardBehaviorAudit.gapCodes,
      approximationCodes: cardBehaviorAudit.approximationCodes,
      ledger: cardBehaviorAudit.ledger,
      method: cardBehaviorLedger?.method ?? null,
      evidence: [CARD_BEHAVIOR_LEDGER_PATH, CARD_NOTES_PATH, ALL_CARDS_LEDGER_PATH],
    },
  },
  evidence: {
    files: {
      [KEYWORDS_PATH]: sha256File(KEYWORDS_PATH),
      [RULEBOOK_PATH]: sha256File(RULEBOOK_PATH),
      [UI_CARDS_PATH]: sha256File(UI_CARDS_PATH),
      [MECHANICS_PATH]: sha256File(MECHANICS_PATH),
      [RULES_TEST_PATH]: sha256File(RULES_TEST_PATH),
      [BROWSER_SPEC_PATH]: sha256File(BROWSER_SPEC_PATH),
      [INTERACTIONS_UI_PATH]: sha256File(INTERACTIONS_UI_PATH),
      [INTERACTIONS_CSS_PATH]: sha256File(INTERACTIONS_CSS_PATH),
      [INTERACTIONS_TEST_PATH]: sha256File(INTERACTIONS_TEST_PATH),
      [INTERACTIONS_SPEC_PATH]: sha256File(INTERACTIONS_SPEC_PATH),
      [BROWSER_PATH]: sha256File(BROWSER_PATH),
      [MECHANISM_SCAN_PATH]: sha256File(MECHANISM_SCAN_PATH),
      // P6：调查员包、逐人验收与三个调查员专属读点模块的哈希。
      [INVESTIGATOR_PACK_PATH]: sha256File(INVESTIGATOR_PACK_PATH),
      [INVESTIGATOR_TEST_PATH]: sha256File(INVESTIGATOR_TEST_PATH),
      ...Object.fromEntries(INVESTIGATOR_HELPERS.map(path => [path, sha256File(path)])),
      // P7：玩家包、逐卡账本/生成模块、验收工具、账本测试、构筑与战役接线、4 个分片测试。
      [PLAYER_PACK_PATH]: sha256File(PLAYER_PACK_PATH),
      [PLAYER_ACCEPTANCE_TOOL_PATH]: sha256File(PLAYER_ACCEPTANCE_TOOL_PATH),
      [PLAYER_ACCEPTANCE_LEDGER_PATH]: sha256File(PLAYER_ACCEPTANCE_LEDGER_PATH),
      [PLAYER_ACCEPTANCE_MODULE_PATH]: sha256File(PLAYER_ACCEPTANCE_MODULE_PATH),
      [PLAYER_LEDGER_TEST_PATH]: sha256File(PLAYER_LEDGER_TEST_PATH),
      [AVAILABILITY_PATH]: sha256File(AVAILABILITY_PATH),
      [CAMPAIGN_PATH]: sha256File(CAMPAIGN_PATH),
      ...Object.fromEntries(PLAYER_TEST_FILES.map(path => [path, sha256File(path)])),
      // P8：9 章剧本验收工具、逐章账本、来源锁、账本测试、逐章测试与实机浏览器用例。
      [SCENARIO_ACCEPTANCE_TOOL_PATH]: sha256File(SCENARIO_ACCEPTANCE_TOOL_PATH),
      [SCENARIO_ACCEPTANCE_LEDGER_PATH]: sha256File(SCENARIO_ACCEPTANCE_LEDGER_PATH),
      [SCENARIO_SOURCE_LOCK_PATH]: sha256File(SCENARIO_SOURCE_LOCK_PATH),
      [SCENARIO_LEDGER_TEST_PATH]: sha256File(SCENARIO_LEDGER_TEST_PATH),
      [SCENARIO_BROWSER_SPEC_PATH]: sha256File(SCENARIO_BROWSER_SPEC_PATH),
      ...Object.fromEntries(scenarioTestFiles.map(path => [path, sha256File(path)])),
      // P9：剧情生成器/生成物/测试、幕间与战役流程、运行时与通用效果、campaignView 与 campaign-flow 校验器。
      [STORY_TOOL_PATH]: sha256File(STORY_TOOL_PATH),
      [STORY_TEXT_PATH]: sha256File(STORY_TEXT_PATH),
      [STORY_TEST_PATH]: sha256File(STORY_TEST_PATH),
      [INTERLUDES_PATH]: sha256File(INTERLUDES_PATH),
      [CAMPAIGN_MANIFEST_PATH]: sha256File(CAMPAIGN_MANIFEST_PATH),
      [STORY_ENGINE_PATH]: sha256File(STORY_ENGINE_PATH),
      [STORY_EFFECTS_PATH]: sha256File(STORY_EFFECTS_PATH),
      [CAMPAIGN_VIEW_PATH]: sha256File(CAMPAIGN_VIEW_PATH),
      ['src/campaign/campaign-flow.js']: sha256File('src/campaign/campaign-flow.js'),
      // P10：逐卡账本/工具/生成模块/逐卡备注、发布浏览器 spec、展示素材与音乐来源（图片/音频按原始字节哈希）。
      [ALL_CARDS_TOOL_PATH]: sha256File(ALL_CARDS_TOOL_PATH),
      [ALL_CARDS_LEDGER_PATH]: sha256File(ALL_CARDS_LEDGER_PATH),
      [ALL_CARDS_MODULE_PATH]: sha256File(ALL_CARDS_MODULE_PATH),
      [ALL_CARDS_TEST_PATH]: sha256File(ALL_CARDS_TEST_PATH),
      [CARD_FIDELITY_TEST_PATH]: sha256File(CARD_FIDELITY_TEST_PATH),
      [CARD_NOTES_PATH]: sha256File(CARD_NOTES_PATH),
      [CARD_BEHAVIOR_LEDGER_PATH]: sha256File(CARD_BEHAVIOR_LEDGER_PATH),
      [RELEASE_SPEC_PATH]: sha256File(RELEASE_SPEC_PATH),
      [MEDIA_SPEC_PATH]: sha256File(MEDIA_SPEC_PATH),
      [PRESENTATION_PATH]: sha256File(PRESENTATION_PATH),
      [MUSIC_PLAYER_PATH]: sha256File(MUSIC_PLAYER_PATH),
      [MUSIC_PLAYLIST_PATH]: sha256File(MUSIC_PLAYLIST_PATH),
      [MUSIC_SOURCES_PATH]: sha256File(MUSIC_SOURCES_PATH),
      ...Object.fromEntries([...themeAssetPaths].map(assetPath => [assetPath, sha256BinaryFile(assetPath)])),
    },
    nodeAcceptance,
    interactionsAcceptance,
    investigatorAcceptance,
    playerAcceptance,
    playerLedgerAcceptance,
    scenarioAcceptance,
    scenarioLedgerAcceptance,
    storyGenerator,
    storyAcceptance,
    browser: { path: BROWSER_PATH, generatedBy: browserReport?.generatedBy ?? null, status: browserReport?.status ?? null },
  },
  tests: testFiles,
  remaining,
  gate: { ...gate, pass },
}

const json = `${JSON.stringify(audit, null, 2)}\n`
if (MODE === 'write') {
  mkdirSync(new URL('../audit/', import.meta.url), { recursive: true })
  writeFileSync(TARGET, json, 'utf8')
  console.log(`audit: audit/tcu-migration.json · milestone ${audit.milestone} · gate ${pass ? 'pass' : 'fail'}`)
  console.log(`关键词 ${gate.keywordsVerified.verified}/${gate.keywordsVerified.total} · 规则书 ${rulebookStatus} · 章节 ${scenarios.length} · launched ${!launchBlocked} · 大厅 ${lobbyVisible}`)
  console.log(`玩家卡 ${gate.playerCardsVerified.verified}/${gate.playerCardsVerified.total} verified · 可构筑 ${gate.playerCardsVerified.buildable} · 基础弱点 ${gate.playerCardsVerified.basicWeaknesses} · 显式简化 ${simplifiedCards.filter(item => PLAYER_CARD_CODES.includes(item.code)).length}`)
  console.log(`剧本 ${gate.scenariosVerified.verified}/${gate.scenariosVerified.total} verified · 待实现遭遇卡 ${gate.scenariosVerified.pendingEncounterCards} · 显式简化 ${gate.scenariosVerified.gaps}`)
  console.log(`剧情 ${gate.storyVerified.verified}/${gate.storyVerified.chapters} 章正文 · 结局 ${gate.storyVerified.endings} · 幕间 ${gate.storyVerified.interludes} · flow 节点 ${gate.storyVerified.flowNodes} · 生成器 ${storyGenerator.ok ? 'ok' : 'fail'} · 剧情测试 ${storyAcceptance.passed}/${storyAcceptance.tests}`)
  console.log(`逐卡账本 ${gate.allCardsVerified.verified}/${gate.allCardsVerified.total} 条 · 记录 ${gate.allCardsVerified.records} + 关联面 ${gate.allCardsVerified.faces} · pending ${gate.allCardsVerified.pending} · 分区 ${JSON.stringify(gate.allCardsVerified.partitions)}`)
  console.log(`发布浏览器 release ${String(gate.releaseBrowser.release.desktop)}/${String(gate.releaseBrowser.release.mobile)} · media ${String(gate.releaseBrowser.media.desktop)}/${String(gate.releaseBrowser.media.mobile)} · 展示素材 图 ${gate.presentationAssets.images} / 曲 ${gate.presentationAssets.trackFiles} · 玩家池 ${gate.playerPoolOpen.deckable}`)
  console.log(`逐卡行为审计 ${gate.cardBehaviorAudit.match} match / ${gate.cardBehaviorAudit.approximation} approximation / ${gate.cardBehaviorAudit.gap} gap · earlyAccess ${audit.earlyAccess} · releaseGate ${gate.releaseGate.pass}`)
  for (const [key, value] of Object.entries(gate)) if (!value.pass) console.log(`  gate 未通过 ${key}: ${JSON.stringify(value).slice(0, 400)}`)
} else if (MODE === 'check') {
  if (!existsSync(TARGET)) {
    console.error('audit/tcu-migration.json 不存在：先运行 --write')
    process.exit(1)
  }
  const disk = readFileSync(TARGET, 'utf8')
  if (disk !== json) {
    const previous = JSON.parse(disk)
    const changed = Object.keys(audit).filter(key => JSON.stringify(previous[key]) !== JSON.stringify(audit[key]))
    console.error(`audit/tcu-migration.json 与内容不一致（重新 --write 并审阅 diff）：${changed.join(', ') || '格式/换行'}`)
    process.exit(1)
  }
  if (!pass) {
    console.log(JSON.stringify(gate))
    process.exit(1)
  }
  console.log(`audit 复算一致：${audit.milestone}，关键词 ${gate.keywordsVerified.verified}/${gate.keywordsVerified.total}，规则书 ${rulebookStatus}，gate pass`)
} else {
  console.log(json)
}
