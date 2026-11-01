// 食梦者（The Dream Eaters）P9：战役记录「卡面印刷数据 ↔ 关卡定义/单卡条目」逐卡字面验收测试。
//
// 口径（docs/tde-migration-roadmap.md §8.3 / §11.2、docs/arkham-content-migration.md §5.2 证据规则）：
//   · 每条 test 名以 `TDE <06xxx>` 开头，`tools/audit-tde-all-cards.mjs` 只从**实跑的 test:pass 事件**
//     归集逐卡证据，不读源码字符串、不读冻结 JSON；
//   · 283 条战役记录逐张核对：目录卡身份（cards-data）→ 遭遇组归属 → 章节 definition 的印刷字段
//     （敌人 fight/evade/health/damage/horror，地点 shroud/clues/victory，幕/议程 doomThreshold/
//     advanceText，剧情面 name/text）→ 单卡条目实现读点（implementedFor / NON_PLAYER_ABILITY_ENTRIES）；
//   · 34 个关联面（06xxxa/b）按 linkedCardCode/linkedToCode 归到主卡或成对关联面，证据取主卡定义/
//     翻面链接/单卡条目；其中 06057b/06058b 是 P8 明示的 noEntry 背面故事面（行为由 06057/06058 的
//     翻面流程承载），见 TDE_NO_ENTRY_REASONS；
//   · 8 张剧本参考卡（06039/06063/06119/06168/06206/06247/06286/06333）的「实现」= 本章
//     definition.js/behavior.js/index.js（manifest.referenceCode），没有单卡条目；
//   · 定义来源 = 8 章真实模块（index.js 的 scenario + definition.js 的导出，含变体幕/区域表等），
//     不读源码文本、不读 scope.json（artifacts 不签入）；
//   · 目录卡与定义不一致时**不放宽断言**：真实失败会逐条列出，由 P9 主进程修复 content。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { implementedFor } from '../src/cards/card-rules.js'
import { NON_PLAYER_ABILITY_ENTRIES } from '../src/cards/encounter-abilities.js'
import { TDE_PACKS } from '../content/campaigns/theDreamEaters/card-data.js'
import {
  CAMPAIGN_CARD_CODES, CAMPAIGN_FACE_CODES, tdeCampaignCardVerified,
} from '../content/packs/tdeCampaign/manifest.js'
import { INVESTIGATOR_CARD_CODES } from '../content/packs/tdeInvestigators/manifest.js'
import { PLAYER_CARD_CODES } from '../content/packs/tdePlayer/manifest.js'
import { chapters, SHARED_ENCOUNTER_GROUPS } from '../content/campaigns/theDreamEaters/shared.js'
import {
  TDE_NO_ENTRY_CODES, TDE_NO_ENTRY_REASONS,
} from '../content/campaigns/theDreamEaters/card-acceptance.js'
import * as beyondTheGatesOfSleepDefinition
  from '../content/campaigns/theDreamEaters/scenarios/beyondTheGatesOfSleep/definition.js'
import * as wakingNightmareDefinition
  from '../content/campaigns/theDreamEaters/scenarios/wakingNightmare/definition.js'
import * as theSearchForKadathDefinition
  from '../content/campaigns/theDreamEaters/scenarios/theSearchForKadath/definition.js'
import * as aThousandShapesOfHorrorDefinition
  from '../content/campaigns/theDreamEaters/scenarios/aThousandShapesOfHorror/definition.js'
import * as darkSideOfTheMoonDefinition
  from '../content/campaigns/theDreamEaters/scenarios/darkSideOfTheMoon/definition.js'
import * as pointOfNoReturnDefinition
  from '../content/campaigns/theDreamEaters/scenarios/pointOfNoReturn/definition.js'
import * as whereTheGodsDwellDefinition
  from '../content/campaigns/theDreamEaters/scenarios/whereTheGodsDwell/definition.js'
import * as weaverOfTheCosmosDefinition
  from '../content/campaigns/theDreamEaters/scenarios/weaverOfTheCosmos/definition.js'
import * as beyondTheGatesOfSleepChapter
  from '../content/campaigns/theDreamEaters/scenarios/beyondTheGatesOfSleep/index.js'
import * as wakingNightmareChapter
  from '../content/campaigns/theDreamEaters/scenarios/wakingNightmare/index.js'
import * as theSearchForKadathChapter
  from '../content/campaigns/theDreamEaters/scenarios/theSearchForKadath/index.js'
import * as aThousandShapesOfHorrorChapter
  from '../content/campaigns/theDreamEaters/scenarios/aThousandShapesOfHorror/index.js'
import * as darkSideOfTheMoonChapter
  from '../content/campaigns/theDreamEaters/scenarios/darkSideOfTheMoon/index.js'
import * as pointOfNoReturnChapter
  from '../content/campaigns/theDreamEaters/scenarios/pointOfNoReturn/index.js'
import * as whereTheGodsDwellChapter
  from '../content/campaigns/theDreamEaters/scenarios/whereTheGodsDwell/index.js'
import * as weaverOfTheCosmosChapter
  from '../content/campaigns/theDreamEaters/scenarios/weaverOfTheCosmos/index.js'

// 只在「卡面定义存在、但特殊行为尚未逐条等价」时登记；当前为空。
// 不得用本清单掩盖印刷数据不一致。
export const PENDING_TDE_CAMPAIGN_CODES = Object.freeze([])

const chapterModules = {
  beyondTheGatesOfSleep: beyondTheGatesOfSleepChapter,
  wakingNightmare: wakingNightmareChapter,
  theSearchForKadath: theSearchForKadathChapter,
  aThousandShapesOfHorror: aThousandShapesOfHorrorChapter,
  darkSideOfTheMoon: darkSideOfTheMoonChapter,
  pointOfNoReturn: pointOfNoReturnChapter,
  whereTheGodsDwell: whereTheGodsDwellChapter,
  weaverOfTheCosmos: weaverOfTheCosmosChapter,
}
const definitionModules = {
  beyondTheGatesOfSleep: beyondTheGatesOfSleepDefinition,
  wakingNightmare: wakingNightmareDefinition,
  theSearchForKadath: theSearchForKadathDefinition,
  aThousandShapesOfHorror: aThousandShapesOfHorrorDefinition,
  darkSideOfTheMoon: darkSideOfTheMoonDefinition,
  pointOfNoReturn: pointOfNoReturnDefinition,
  whereTheGodsDwell: whereTheGodsDwellDefinition,
  weaverOfTheCosmos: weaverOfTheCosmosDefinition,
}

const knownTypes = new Set(['scenario', 'investigator', 'enemy', 'treachery', 'location', 'act',
  'agenda', 'asset', 'story'])
const localized = (card, field) => card?.[`${field}Zh`] || card?.[field] || ''
const originalOf = card => card?.originalCode || card?.code

function collectDefinitions(value, result = [], seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return result
  seen.add(value)
  if (Array.isArray(value)) {
    for (const item of value) collectDefinitions(item, result, seen)
    return result
  }
  if (typeof value.originalCode === 'string') result.push(value)
  for (const item of Object.values(value)) collectDefinitions(item, result, seen)
  return result
}

// scenario 数据 + definition.js 的模块导出（变体幕/区域表/故事面表等，运行时也是真实数据）。
const scenarioData = chapters.map(chapter => chapterModules[chapter.id].scenario)
const extraDefinitions = Object.entries(definitionModules).flatMap(([id, module]) =>
  collectDefinitions(Object.entries(module)
    .filter(([key]) => key !== 'scenario')
    .map(([, value]) => value)))
const definitions = [
  ...scenarioData.flatMap(scenario => collectDefinitions(scenario)),
  ...extraDefinitions,
].filter(definition => knownTypes.has(definition.type) && typeof definition.originalCode === 'string')

const definitionsByCode = new Map()
for (const definition of definitions) {
  const code = definition.originalCode
  if (!definitionsByCode.has(code)) definitionsByCode.set(code, [])
  definitionsByCode.get(code).push(definition)
}

// 卡号 → 出现在哪些章节（按 scenario 数据 + definition.js 导出（变体幕/区域表）的
// originalCode 以及翻面链接归属；不读源码文本）。
const chaptersByCode = new Map()
for (const chapter of chapters) {
  const module = definitionModules[chapter.id]
  const chapterDefinitions = [
    ...collectDefinitions(chapterModules[chapter.id].scenario),
    ...collectDefinitions(Object.entries(module)
      .filter(([key]) => key !== 'scenario')
      .map(([, value]) => value)),
  ]
  const codes = new Set(chapterDefinitions.map(definition => definition.originalCode))
  for (const definition of chapterDefinitions) {
    for (const linked of [definition.linkedOriginalCode, definition.backCode, definition.storyCode]) {
      if (linked) codes.add(linked)
    }
  }
  for (const code of codes) {
    if (!chaptersByCode.has(code)) chaptersByCode.set(code, [])
    chaptersByCode.get(code).push(chapter.id)
  }
}

const entryByCode = new Map(NON_PLAYER_ABILITY_ENTRIES.map(entry => [entry.code, entry]))
const entryCodes = new Set(entryByCode.keys())

const campaignCards = CAMPAIGN_CARD_CODES.map(code => ALL_CARDS[code])
const campaignFaces = CAMPAIGN_FACE_CODES.map(code => ALL_CARDS[code])
const campaignCodeSet = new Set(CAMPAIGN_CARD_CODES)
const faceCodeSet = new Set(CAMPAIGN_FACE_CODES)
const allCampaignCodes = [...CAMPAIGN_CARD_CODES, ...CAMPAIGN_FACE_CODES]
const noEntryCodes = new Set(TDE_NO_ENTRY_CODES)
const pending = new Set(PENDING_TDE_CAMPAIGN_CODES)

const encounterGroupCodes = new Set([
  ...chapters.map(chapter => chapter.encounterCode),
  ...SHARED_ENCOUNTER_GROUPS.map(group => group.encounterCode),
])
const encounterGroups = new Map([...encounterGroupCodes].map(code => [code, []]))
for (const code of allCampaignCodes) {
  const group = ALL_CARDS[code]?.encounterCode
  if (encounterGroups.has(group)) encounterGroups.get(group).push(code)
}

// ---------------------------------------------------------------------------
// 范围与身份（先跑；失败时后面的逐卡断言没有意义）
// ---------------------------------------------------------------------------
test('TDE 战役记录范围：283 条记录 = 249 主卡 + 34 关联面，三包主卡分区唯一', () => {
  assert.equal(campaignCards.length, 249)
  assert.equal(campaignFaces.length, 34)
  assert.equal(allCampaignCodes.length, 283)
  assert.equal(new Set(allCampaignCodes).size, 283, '战役记录存在重复卡号')
  assert.ok(Object.values(ALL_CARDS).filter(card => /^06\d{3}[a-z]?$/.test(card.code)).length === 388)
  assert.ok(campaignCards.every(card => card && card.type !== 'investigator'))
  assert.ok(campaignFaces.every(card => card && card.type !== 'investigator'))
  for (const code of allCampaignCodes) {
    assert.ok(ALL_CARDS[code], `战役记录不在卡表：${code}`)
    assert.ok(TDE_PACKS.has(ALL_CARDS[code].pack), `${code} 的包不在食梦者 7 包内：${ALL_CARDS[code].pack}`)
    assert.ok(ALL_CARDS[code].encounterCode, `${code} 缺少遭遇组归属`)
    assert.ok(encounterGroupCodes.has(ALL_CARDS[code].encounterCode),
      `${code} 的遭遇组不在 8 章 + 12 共享组内：${ALL_CARDS[code].encounterCode}`)
  }
  // 三包主卡分区唯一：249 战役 + 16 调查员 + 87 玩家 = 352。
  const mainCodes = Object.values(ALL_CARDS)
    .filter(card => /^06\d{3}$/.test(card.code))
    .map(card => card.code)
  assert.equal(mainCodes.length, 352)
  assert.equal(campaignCards.length + INVESTIGATOR_CARD_CODES.length + PLAYER_CARD_CODES.length, 352)
  const partitions = new Map()
  for (const code of mainCodes) {
    const owners = [
      campaignCodeSet.has(code) ? 'campaign' : null,
      INVESTIGATOR_CARD_CODES.includes(code) ? 'investigator' : null,
      PLAYER_CARD_CODES.includes(code) ? 'player' : null,
    ].filter(Boolean)
    assert.equal(owners.length, 1, `主卡分区不唯一：${code} → ${owners.join(',') || '(none)'}`)
    partitions.set(code, owners[0])
  }
  // 36 个关联面 = 34 战役 + 06015a/b 调查员面。
  const faceCodes = Object.values(ALL_CARDS)
    .filter(card => /^06\d{3}[a-z]$/.test(card.code))
    .map(card => card.code)
  assert.equal(faceCodes.length, 36)
  assert.deepEqual([...faceCodes].sort(), [...allCampaignCodes.filter(code => /[a-z]$/.test(code)),
    '06015a', '06015b'].sort())
  assert.equal(PENDING_TDE_CAMPAIGN_CODES.length, 0)
  assert.deepEqual(noEntryCodes, new Set(['06039', '06063', '06119', '06168', '06206', '06247',
    '06286', '06333', '06057b', '06058b']))
  for (const code of noEntryCodes) assert.ok(TDE_NO_ENTRY_REASONS[code], `${code} 缺少 noEntry 理由`)
})

test('TDE 八章 definition/behavior/index 装配齐全且剧本参考卡回指本章', () => {
  assert.equal(chapters.length, 8)
  for (const chapter of chapters) {
    const chapterModule = chapterModules[chapter.id]
    const definitionModule = definitionModules[chapter.id]
    assert.ok(chapterModule, chapter.id)
    assert.ok(definitionModule, chapter.id)
    assert.equal(chapterModule.manifest.id, chapter.id)
    assert.equal(chapterModule.manifest.campaignId, 'theDreamEaters')
    assert.equal(chapterModule.scenario.id, chapter.id)
    assert.equal(chapterModule.behavior.id, chapter.id)
    assert.equal(chapterModule.manifest.referenceCode, chapter.code,
      `${chapter.id} 的 manifest.referenceCode 与章节参考卡不一致`)
    assert.equal(definitionModule.scenario, chapterModule.scenario,
      `${chapter.id} 的 index.js 与 definition.js 不是同一份 scenario`)
    // 章节参考卡本身 = 本章身份，且没有单卡条目（noEntry 口径）。
    assert.equal(ALL_CARDS[chapter.code]?.type, 'scenario')
    assert.equal(entryCodes.has(chapter.code), false, `${chapter.code} 不应有单卡条目`)
    assert.equal(implementedFor(chapter.code), false, `${chapter.code} 不应命中 implementedFor`)
    const identities = chapterModule.identities || {}
    assert.equal(identities.scenario?.[chapter.id]?.originalCode, chapter.code,
      `${chapter.id} 的 scenario 身份没有回指参考卡`)
    for (const [category, entries] of Object.entries(identities)) {
      for (const [id, identity] of Object.entries(entries || {})) {
        assert.ok(identity.originalCode, `${chapter.id}/${category}/${id} 身份缺 originalCode`)
        assert.equal(identity.identityStatus, 'mapped', `${chapter.id}/${category}/${id} 身份未映射`)
        assert.ok(ALL_CARDS[identity.originalCode], `${chapter.id}/${category}/${id} 的原卡不存在`)
      }
    }
    const hooks = Object.values(chapterModule.behavior).filter(value => typeof value === 'function')
    assert.ok(hooks.length >= 3, `${chapter.id} 行为钩子不足：${hooks.length}`)
    assert.equal(typeof chapterModule.behavior.actReveal, 'function', `${chapter.id} 缺 actReveal`)
    assert.equal(typeof chapterModule.behavior.agendaReveal, 'function', `${chapter.id} 缺 agendaReveal`)
    assert.equal(typeof chapterModule.behavior.resolution, 'function', `${chapter.id} 缺 resolution`)
  }
})

// ---------------------------------------------------------------------------
// 战役主卡：249 张逐卡字面验收
// ---------------------------------------------------------------------------
function assertPrintedStat(code, definition, card, field, fallback = 0) {
  const printed = card[field] ?? fallback
  if (definition[field] === printed) return
  // 卡面把隐藏值印成 X（扫描拿不到 → -2 占位）：definition 取可计算默认值，由条目规则字段求值。
  // 已知唯一分支：06226 月蜥「否则 X 为 5」→ fight/evade=5；其余负值哨兵见 TDE 蓝图附录 B。
  const expectedHidden = ['fight', 'evade'].includes(field) ? 5 : 0
  assert.ok(printed < 0, `${code} ${field} 与 definition 不一致：${definition[field]} / ${printed}`)
  assert.equal(definition[field], expectedHidden,
    `${code} 隐藏值占位 ${field} 应有默认 ${expectedHidden}：${definition[field]}`)
  assert.match(localized(card, 'text'), /X/, `${code} 印刷文本没有声明隐藏值 X（${field}）`)
  const entry = entryByCode.get(code)
  assert.ok(entry, `${code} 隐藏值卡缺少单卡条目`)
  assert.ok(entry.enemyStatRule || entry.locationRule || entry.flags || entry.treacheryRule,
    `${code} 隐藏值卡缺少规则声明（enemyStatRule/locationRule/flags）`)
}

for (const card of campaignCards) {
  const code = card.code
  const status = pending.has(code) ? '待实现' : '已验收'
  test(`TDE ${code} ${status} · ${card.type} 卡文与关卡定义`, () => {
    assert.equal(card.dataStatus, 'validated', `${code} dataStatus 不是 validated`)
    assert.ok(localized(card, 'name'), `${code} 缺少卡名`)
    assert.ok(localized(card, 'text') || localized(card, 'backText') || localized(card, 'flavor'),
      `${code} 缺少卡面文本`)
    assert.ok(chaptersByCode.has(code), `${code} 没有出现在任何食梦者章节 definition 里`)

    if (card.type === 'scenario') {
      // 剧本参考卡：实现 = 本章 definition/behavior，没有单独卡面定义。
      const chapter = chapters.find(candidate => candidate.code === code)
      assert.ok(chapter, `${code} 没有对应的章节`)
      const chapterModule = chapterModules[chapter.id]
      assert.equal(chapterModule.manifest.referenceCode, code, `${code} 章节 referenceCode 不一致`)
      assert.equal(chapter.encounterCode, card.encounterCode, `${code} 遭遇组与章节不一致`)
      assert.equal(chapterModule.manifest.campaignId, 'theDreamEaters')
      assert.equal(tdeCampaignCardVerified(code), true, `${code} 战役包没有声明为已实现`)
      assert.equal(entryCodes.has(code), false, `${code} 是剧本参考卡，不应有单卡条目`)
      assert.equal(implementedFor(code), false)
      return
    }

    assert.equal(tdeCampaignCardVerified(code), true, `${code} 战役包没有声明为已实现`)
    assert.equal(implementedFor(code), true, `${code} 缺少 implementedFor 读取点`)
    assert.ok(entryCodes.has(code), `${code} 缺少一卡一文件的单卡条目`)

    const candidates = definitionsByCode.get(code) || []
    assert.ok(candidates.length > 0, `${code} 在 8 章 definition 中找不到卡面定义`)
    for (const definition of candidates) {
      assert.equal(definition.originalCode, code)
      assert.equal(definition.name, localized(card, 'name'),
        `${code} 名称与 definition 不一致：${definition.name} / ${localized(card, 'name')}`)
      assert.equal(definition.text ?? '', localized(card, 'text'),
        `${code} 卡文与 definition 不一致（definition.type=${definition.type}）`)
      if (card.type === 'enemy') {
        assert.equal(definition.type, 'enemy', `${code} definition 类型应为 enemy`)
        assertPrintedStat(code, definition, card, 'fight')
        assertPrintedStat(code, definition, card, 'evade')
        assertPrintedStat(code, definition, card, 'health', 1)
        assertPrintedStat(code, definition, card, 'damage')
        assertPrintedStat(code, definition, card, 'horror')
        assert.equal(Boolean(definition.healthPerInvestigator), Boolean(card.healthPerInvestigator),
          `${code} healthPerInvestigator 标记不一致`)
        assert.equal(definition.rulesPending, false, `${code} 仍标记 rulesPending`)
      }
      if (card.type === 'treachery') {
        assert.equal(definition.type, 'treachery', `${code} definition 类型应为 treachery`)
        assert.equal(definition.rulesPending, false, `${code} 仍标记 rulesPending`)
      }
      if (card.type === 'location') {
        assert.equal(definition.type, 'location', `${code} definition 类型应为 location`)
        if (definition.shroud === card.shroud) {
          assert.equal(definition.shroud, card.shroud ?? 0, `${code} shroud`)
        } else {
          assert.ok((card.shroud ?? 0) < 0, `${code} shroud 与 definition 不一致：${definition.shroud} / ${card.shroud}`)
          assert.equal(definition.shroud, 0, `${code} 隐藏值占位应有 definition.shroud=0`)
          assert.match(localized(card, 'text'), /X/, `${code} 印刷文本没有声明隐藏值 X`)
          const entry = entryByCode.get(code)
          assert.ok(entry, `${code} 隐藏值卡缺少单卡条目`)
          assert.ok(entry.locationRule || entry.flags, `${code} 隐藏值卡缺少规则声明`)
        }
        assert.equal(definition.cluesPerInvestigator ?? 0, card.clues || 0, `${code} clues`)
        assert.equal(definition.victory ?? 0, card.victory || 0, `${code} victory`)
      }
      if (card.type === 'agenda') {
        assert.equal(definition.type, 'agenda', `${code} definition 类型应为 agenda`)
        assert.equal(definition.doomThreshold ?? 0, card.doom || 0, `${code} doomThreshold`)
        assert.equal(definition.advanceText ?? '', localized(card, 'backText'),
          `${code} 议程推进文本与 definition.advanceText 不一致`)
      }
      if (card.type === 'act') {
        assert.equal(definition.type, 'act', `${code} definition 类型应为 act`)
        assert.equal(definition.advanceText ?? '', localized(card, 'backText'),
          `${code} 幕推进文本与 definition.advanceText 不一致`)
      }
      if (['act', 'agenda'].includes(card.type)) {
        assert.equal(definition.backText ?? '', localized(card, 'backText'),
          `${code} 背面文本与 definition.backText 不一致`)
      }
      if (card.type === 'asset') assert.equal(definition.type, 'asset', `${code} definition 类型应为 asset`)
      if (card.type === 'story') {
        assert.ok(['story', 'asset'].includes(definition.type),
          `${code} 剧情定义类型异常：${definition.type}`)
      }
    }
  })
}

// ---------------------------------------------------------------------------
// 34 个关联面：归到主卡（或成对关联面）后取主卡定义/翻面链接/单卡条目作证据
// ---------------------------------------------------------------------------
function faceRelations(code) {
  const card = ALL_CARDS[code]
  const direct = card.linkedCardCode || card.linkedToCode || null
  const reverse = Object.values(ALL_CARDS)
    .filter(other => other.code !== code
      && (other.linkedCardCode === code || other.linkedToCode === code))
    .map(other => other.code)
  return [...new Set([direct, ...reverse].filter(Boolean))]
}

/** 定义/翻面链接是否承载该面：自身 definition，或被 partner/main 的 linkedOriginalCode/backCode/storyCode 指向。 */
function faceRepresentedByDefinition(code) {
  const own = definitionsByCode.get(code) || []
  if (own.length) return true
  const related = faceRelations(code)
  return related.some(relation => (definitionsByCode.get(relation) || []).some(definition =>
    definition.linkedOriginalCode === code || definition.backCode === code
    || definition.storyCode === code))
}

for (const card of campaignFaces) {
  const code = card.code
  test(`TDE ${code} 已验收 · ${card.type} 关联面 ${faceRelations(code).join('+') || '未链接'}`, () => {
    assert.equal(card.dataStatus, 'validated', `${code} dataStatus 不是 validated`)
    assert.ok(localized(card, 'name'), `${code} 缺少卡名`)
    assert.ok(localized(card, 'text') || localized(card, 'backText') || localized(card, 'flavor'),
      `${code} 缺少卡面文本`)
    const relations = faceRelations(code)
    assert.equal(relations.length, 1,
      `${code} 关联面必须恰好链接一个主卡/成对关联面：${relations.join(',')}`)
    assert.ok(allCampaignCodes.includes(relations[0]),
      `${code} 关联对象不在战役记录内：${relations[0]}`)
    assert.ok(faceRepresentedByDefinition(code), `${code} 没有任何 definition/翻面链接证据`)
    assert.ok(chaptersByCode.has(code) || chaptersByCode.has(relations[0]),
      `${code} 与关联对象都没有进入章节 definition`)

    if (noEntryCodes.has(code)) {
      // P8 明示 noEntry 的背面故事面：行为由主卡的翻面流程承载。
      assert.equal(entryCodes.has(code), false, `${code} 是 noEntry，不应有单卡条目`)
      assert.equal(implementedFor(code), false, `${code} 是 noEntry，不应命中 implementedFor`)
      const mainCode = relations[0]
      const mainDefinitions = definitionsByCode.get(mainCode) || []
      assert.ok(mainDefinitions.some(definition => definition.linkedOriginalCode === code),
        `${code} 的主卡 ${mainCode} definition 没有 linkedOriginalCode 指向本面`)
      assert.equal(implementedFor(mainCode), true, `${code} 的主卡 ${mainCode} 缺少实现读点`)
      assert.ok(TDE_NO_ENTRY_REASONS[code])
      return
    }

    assert.equal(implementedFor(code), true, `${code} 缺少 implementedFor 读取点`)
    assert.ok(entryCodes.has(code), `${code} 缺少一卡一文件的单卡条目`)
    for (const definition of definitionsByCode.get(code) || []) {
      assert.equal(definition.name, localized(card, 'name'),
        `${code} 关联面定义名称不一致：${definition.name} / ${localized(card, 'name')}`)
      assert.equal(definition.text ?? '', localized(card, 'text'),
        `${code} 关联面定义卡文不一致`)
      if (card.type === 'agenda') {
        assert.equal(definition.doomThreshold ?? 0, card.doom || 0, `${code} doomThreshold`)
        assert.equal(definition.advanceText ?? '', localized(card, 'backText'),
          `${code} 关联面议程推进文本不一致`)
      }
      if (card.type === 'enemy') assertPrintedStat(code, definition, card, 'fight')
    }
  })
}

// ---------------------------------------------------------------------------
// noEntry 登记与单卡文件对账（P8 口径：8 张剧本参考卡 + 2 张背面故事面）
// ---------------------------------------------------------------------------
test('TDE noEntry 登记：10 条记录逐条有理由（8 剧本参考卡 + 2 背面故事面）', () => {
  const gameRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const entryFiles = new Map()
  const walk = directory => {
    if (!fs.existsSync(directory)) return
    for (const name of fs.readdirSync(directory)) {
      const full = path.join(directory, name)
      if (fs.statSync(full).isDirectory()) walk(full)
      else if (name.endsWith('.js') && name !== 'index.js' && !name.startsWith('_')) {
        entryFiles.set(name.replace(/\.js$/, ''), full)
      }
    }
  }
  walk(path.join(gameRoot, 'src/cards/encounter-entries/theDreamEaters'))
  walk(path.join(gameRoot, 'src/cards/encounter-entries/shared'))
  const tdeEntryFiles = [...entryFiles.keys()]
    .filter(code => /^06\d{3}[a-z]?$/.test(code))
    .sort()
  assert.equal(tdeEntryFiles.length, 273, `食梦者单卡文件应为 273 条：${tdeEntryFiles.length}`)
  assert.deepEqual(tdeEntryFiles, allCampaignCodes.filter(code => !noEntryCodes.has(code)).sort())
  assert.equal(noEntryCodes.size, 10)
  for (const code of TDE_NO_ENTRY_CODES) {
    assert.equal(entryFiles.has(code), false, `${code} 是 noEntry，不应有单卡文件`)
    assert.ok(TDE_NO_ENTRY_REASONS[code]?.trim(), `${code} 缺少 noEntry 理由`)
  }
  // 8 张剧本参考卡：type=scenario，实现 = 本章 definition/behavior。
  const scenarioNoEntry = TDE_NO_ENTRY_CODES.filter(code => ALL_CARDS[code].type === 'scenario')
  assert.equal(scenarioNoEntry.length, 8)
  assert.deepEqual([...scenarioNoEntry].sort(), chapters.map(chapter => chapter.code).sort())
  // 2 张背面故事面：正面（linkedCardCode 反查）有单卡条目并实现。
  const storyFaces = TDE_NO_ENTRY_CODES.filter(code => ALL_CARDS[code].type === 'story')
  assert.deepEqual([...storyFaces].sort(), ['06057b', '06058b'])
  for (const code of storyFaces) {
    const front = Object.values(ALL_CARDS).find(card => card.linkedCardCode === code)
    assert.ok(front, `${code} 没有正向链接的正面`)
    assert.equal(implementedFor(front.code), true, `${code} 的正面 ${front.code} 缺少实现读点`)
    assert.equal(entryCodes.has(front.code), true, `${code} 的正面 ${front.code} 缺少单卡条目`)
    assert.equal(entryCodes.has(code), false, `${code} 是 noEntry，不应有单卡条目`)
  }
})

// ---------------------------------------------------------------------------
// 跨章共享卡：同一张印刷卡在多章 definition 里必须同值
// ---------------------------------------------------------------------------
test('TDE 跨章共享卡 definition 印刷字段一致（06053 等）', () => {
  const fields = ['name', 'text', 'fight', 'evade', 'health', 'damage', 'horror', 'shroud',
    'cluesPerInvestigator', 'doomThreshold', 'advanceText', 'backText']
  let compared = 0
  for (const code of allCampaignCodes) {
    const candidates = definitionsByCode.get(code) || []
    if (candidates.length < 2) continue
    compared++
    const [primary, ...rest] = candidates
    for (const definition of rest) {
      for (const field of fields) {
        if (!(field in primary) && !(field in definition)) continue
        assert.deepEqual(definition[field], primary[field],
          `${code} 的 ${field} 在跨章 definition 中不一致`)
      }
    }
  }
  assert.ok(compared > 0, '没有任何跨章共享卡可比较，口径失效')
})

// ---------------------------------------------------------------------------
// 收尾：283 条记录逐条有实现落点、10 条 noEntry 与 273 条单卡条目对账
// ---------------------------------------------------------------------------
test('TDE 283 条战役记录逐条有实现落点，10 条 noEntry 与 273 条单卡条目对账', () => {
  const tdeEntries = [...entryCodes].filter(code => /^06\d{3}[a-z]?$/.test(code))
  assert.equal(tdeEntries.length, 273, `食梦者单卡条目应为 273 条：${tdeEntries.length}`)
  assert.equal(tdeEntries.length + noEntryCodes.size, 283)
  assert.equal(pending.size, 0)

  const uncovered = []
  for (const code of allCampaignCodes) {
    const card = ALL_CARDS[code]
    const covered = noEntryCodes.has(code)
      ? (card.type === 'scenario' || /[a-z]$/.test(code))
      : (implementedFor(code) || faceRepresentedByDefinition(code))
    if (!covered) uncovered.push(code)
  }
  assert.deepEqual(uncovered, [], '存在没有实现落点的战役记录')
  // 273 条条目的 code 集合必须与「283 - 10 noEntry」完全一致。
  assert.deepEqual([...tdeEntries].sort(),
    allCampaignCodes.filter(code => !noEntryCodes.has(code)).sort())

  // 20 个遭遇组（8 章 + 12 共享组）都有战役记录，且记录数守恒 283。
  assert.equal(encounterGroups.size, 20)
  let assigned = 0
  for (const [groupCode, codes] of encounterGroups) {
    assert.ok(codes.length > 0, `遭遇组没有任何食梦者战役记录：${groupCode}`)
    assigned += codes.length
  }
  assert.equal(assigned, 283)
})

test('TDE 战役卡类型全部有验收分支，不存在静默跳过的类型', () => {
  const expected = new Set(['scenario', 'enemy', 'treachery', 'location', 'act', 'agenda', 'asset', 'story'])
  const actual = new Set(campaignCards.map(card => card.type))
  assert.deepEqual([...actual].sort(), [...expected].sort())
  const faceTypes = new Set(campaignFaces.map(card => card.type))
  for (const type of faceTypes) assert.ok(['story', 'agenda', 'enemy'].includes(type),
    `未支持的关联面类型：${type}`)
})
