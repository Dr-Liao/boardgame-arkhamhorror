// 万象无终（The Circle Undone）P10：战役卡「卡面印刷数据 ↔ 关卡定义」逐卡字面测试。
//
// 口径（docs/tcu-migration-roadmap.md §8.3 证据规则）：
//   · 每条 test 名以 `TCU <05xxx>` 开头，tools/audit-tcu-all-cards.mjs 只从**实跑的 test:pass 事件**
//     归集逐卡证据，不读源码字符串、不读冻结 JSON；
//   · 战役 237 张主卡逐张核对：目录卡 dataStatus/名称/文本存在 → 在运行表面被引用 →
//     按类型核对 definition 的印刷字段（敌人 fight/evade/health，地点 shroud/clues，幕/议程
//     doomThreshold/advanceText 等）→ 单卡行为读点（implementedFor / investigatorRule / 章节 behavior）；
//   · 34 个关联面（05xxxa/b…）不是独立主卡：按 linkedCardCode/linkedToCode 归到主卡或成对关联面，
//     证据取主卡定义/行为链接；账本 partition 记 'face'；
//   · 定义来源 = content/registered.js 的 contentRegistry.getScenarioData/getBehavior（9 章真实模块）
//     + 9 个 definition.js 模块的导出（变体幕 ACT_DECKS / VARIANT_ACTS / membersAct1 / 序章调查员设置等，
//     这些变体不在 scenario 数据里，但属于该章运行面）；
//   · 目录卡与定义不一致时**不放宽断言**：脚本运行输出会逐条列出不一致，由 P10 主进程修复 content。
import test from 'node:test'
import assert from 'node:assert/strict'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { contentRegistry } from '../content/registered.js'
import {
  CAMPAIGN_CARD_CODES, tcuCampaignCardVerified,
} from '../content/packs/tcuCampaign/manifest.js'
import { tcuInvestigatorCardVerified } from '../content/packs/tcuInvestigators/manifest.js'
import { tcuPlayerCardVerified } from '../src/cards/tcu-player-acceptance.js'
import { implementedFor, investigatorRule } from '../src/cards/card-rules.js'
import { TCU_PACKS } from '../content/campaigns/theCircleUndone/card-data.js'
import * as disappearanceAtTheTwilightEstateDefinition
  from '../content/campaigns/theCircleUndone/scenarios/disappearanceAtTheTwilightEstate/definition.js'
import * as theWitchingHourDefinition
  from '../content/campaigns/theCircleUndone/scenarios/theWitchingHour/definition.js'
import * as atDeathsDoorstepDefinition
  from '../content/campaigns/theCircleUndone/scenarios/atDeathsDoorstep/definition.js'
import * as theSecretNameDefinition
  from '../content/campaigns/theCircleUndone/scenarios/theSecretName/definition.js'
import * as theWagesOfSinDefinition
  from '../content/campaigns/theCircleUndone/scenarios/theWagesOfSin/definition.js'
import * as forTheGreaterGoodDefinition
  from '../content/campaigns/theCircleUndone/scenarios/forTheGreaterGood/definition.js'
import * as unionAndDisillusionDefinition
  from '../content/campaigns/theCircleUndone/scenarios/unionAndDisillusion/definition.js'
import * as inTheClutchesOfChaosDefinition
  from '../content/campaigns/theCircleUndone/scenarios/inTheClutchesOfChaos/definition.js'
import * as beforeTheBlackThroneDefinition
  from '../content/campaigns/theCircleUndone/scenarios/beforeTheBlackThrone/definition.js'
import * as disappearanceAtTheTwilightEstateBehavior
  from '../content/campaigns/theCircleUndone/scenarios/disappearanceAtTheTwilightEstate/behavior.js'
import * as theWitchingHourBehavior
  from '../content/campaigns/theCircleUndone/scenarios/theWitchingHour/behavior.js'
import * as atDeathsDoorstepBehavior
  from '../content/campaigns/theCircleUndone/scenarios/atDeathsDoorstep/behavior.js'
import * as theSecretNameBehavior
  from '../content/campaigns/theCircleUndone/scenarios/theSecretName/behavior.js'
import * as theWagesOfSinBehavior
  from '../content/campaigns/theCircleUndone/scenarios/theWagesOfSin/behavior.js'
import * as forTheGreaterGoodBehavior
  from '../content/campaigns/theCircleUndone/scenarios/forTheGreaterGood/behavior.js'
import * as unionAndDisillusionBehavior
  from '../content/campaigns/theCircleUndone/scenarios/unionAndDisillusion/behavior.js'
import * as inTheClutchesOfChaosBehavior
  from '../content/campaigns/theCircleUndone/scenarios/inTheClutchesOfChaos/behavior.js'
import * as beforeTheBlackThroneBehavior
  from '../content/campaigns/theCircleUndone/scenarios/beforeTheBlackThrone/behavior.js'

// 这些卡在关卡数据里已登记，但其卡面特殊行为尚未逐条等价（当前为空）。
// 只登记「有卡面定义、缺行为证据」的卡；不得用本清单掩盖印刷数据不一致。
export const PENDING_TCU_CAMPAIGN_CODES = Object.freeze([])

const definitionModules = {
  disappearanceAtTheTwilightEstate: disappearanceAtTheTwilightEstateDefinition,
  theWitchingHour: theWitchingHourDefinition,
  atDeathsDoorstep: atDeathsDoorstepDefinition,
  theSecretName: theSecretNameDefinition,
  theWagesOfSin: theWagesOfSinDefinition,
  forTheGreaterGood: forTheGreaterGoodDefinition,
  unionAndDisillusion: unionAndDisillusionDefinition,
  inTheClutchesOfChaos: inTheClutchesOfChaosDefinition,
  beforeTheBlackThrone: beforeTheBlackThroneDefinition,
}
const behaviorModules = {
  disappearanceAtTheTwilightEstate: disappearanceAtTheTwilightEstateBehavior,
  theWitchingHour: theWitchingHourBehavior,
  atDeathsDoorstep: atDeathsDoorstepBehavior,
  theSecretName: theSecretNameBehavior,
  theWagesOfSin: theWagesOfSinBehavior,
  forTheGreaterGood: forTheGreaterGoodBehavior,
  unionAndDisillusion: unionAndDisillusionBehavior,
  inTheClutchesOfChaos: inTheClutchesOfChaosBehavior,
  beforeTheBlackThrone: beforeTheBlackThroneBehavior,
}

const knownTypes = new Set(['scenario', 'investigator', 'enemy', 'treachery', 'location', 'act',
  'agenda', 'asset', 'story'])
const campaign = contentRegistry.getCampaign('theCircleUndone')
const scenarioIds = campaign.scenarioIds
const scenarioData = scenarioIds.map(id => contentRegistry.getScenarioData(id))
const behaviorData = scenarioIds.map(id => contentRegistry.getBehavior(id))
const pending = new Set(PENDING_TCU_CAMPAIGN_CODES)

function localized(card, field) {
  return card[`${field}Zh`] || card[field] || ''
}

function collectDefinitions(value, result = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectDefinitions(item, result)
    return result
  }
  if (!value || typeof value !== 'object') return result
  if (typeof value.originalCode === 'string') result.push(value)
  for (const item of Object.values(value)) collectDefinitions(item, result)
  return result
}

// scenario 数据里没有的变体幕/变体调查员设置：从 definition.js 的模块导出补齐。
const extraDefinitions = Object.entries(definitionModules).flatMap(([id, module]) =>
  collectDefinitions(Object.entries(module)
    .filter(([key]) => key !== 'scenario')
    .map(([, value]) => value)))
const definitions = [...scenarioData.flatMap(scenario => collectDefinitions(scenario)), ...extraDefinitions]
const definitionsByCode = new Map()
for (const definition of definitions) {
  const code = definition.originalCode
  if (!definitionsByCode.has(code)) definitionsByCode.set(code, [])
  definitionsByCode.get(code).push(definition)
}

// 印刷数据和运行表面（definition/behavior 导出的纯数据）的 JSON 快照。
// 注意：这里只用**运行模块的真实导出**拼 JSON，不读源码文本。
const definitionSurface = Object.entries(definitionModules).map(([, module]) => {
  const surface = {}
  for (const [key, value] of Object.entries(module)) {
    if (typeof value === 'function' || key === 'scenario') continue
    surface[key] = value
  }
  return surface
})
const runtimeJson = JSON.stringify([...scenarioData, ...definitionSurface])
const behaviorFunctions = scenarioIds.flatMap((id, index) => Object.values(behaviorData[index])
  .filter(value => typeof value === 'function')
  .map(value => Function.prototype.toString.call(value)))
const behaviorSurface = `${behaviorFunctions.join('\n')}\n${JSON.stringify(behaviorData)}`

const linkedCodes = new Map()
for (const card of Object.values(ALL_CARDS)) {
  for (const linked of [card.linkedToCode, card.linkedCardCode].filter(Boolean)) {
    linkedCodes.set(card.code, [...new Set([...(linkedCodes.get(card.code) || []), linked])])
    linkedCodes.set(linked, [...new Set([...(linkedCodes.get(linked) || []), card.code])])
  }
}

const tcuCards = Object.values(ALL_CARDS)
  .filter(card => TCU_PACKS.has(card.pack) && /^05\d{3}[a-z]?$/.test(card.code))
const mainCards = tcuCards
  .filter(card => /^05\d{3}$/.test(card.code))
  .sort((left, right) => left.code.localeCompare(right.code))
const faceCards = tcuCards
  .filter(card => /^05\d{3}[a-z]$/.test(card.code))
  .sort((left, right) => left.code.localeCompare(right.code))
const campaignCards = mainCards
  .filter(card => !tcuInvestigatorCardVerified(card.code) && !tcuPlayerCardVerified(card.code))
const campaignCodes = new Set(campaignCards.map(card => card.code))
const campaignByCode = new Map(campaignCards.map(card => [card.code, card]))

const scenarioForCode = code => scenarioData.find(scenario => scenario.originalCode === code) || null

function expectedDefinitionType(card) {
  return card.type === 'story' ? 'asset' : card.type
}

function definitionCandidates(code) {
  return (definitionsByCode.get(code) || []).filter(definition => knownTypes.has(definition.type))
}

function definitionFor(code) {
  const card = ALL_CARDS[code]
  if (!card) return null
  const candidates = definitionCandidates(code)
  return candidates.find(definition => definition.type === expectedDefinitionType(card))
    || candidates[0]
    || null
}

function represented(code) {
  if (runtimeJson.includes(`"${code}"`)) return true
  return (linkedCodes.get(code) || []).some(linked => runtimeJson.includes(`"${linked}"`))
}

function behaviorLinked(code) {
  if (implementedFor(code)) return true
  return (linkedCodes.get(code) || []).some(linked => implementedFor(linked))
}

function faceRelation(code) {
  const card = ALL_CARDS[code]
  const direct = card.linkedCardCode || card.linkedToCode || null
  const reverse = Object.values(ALL_CARDS)
    .filter(other => other.linkedCardCode === code)
    .map(other => other.code)
  return { direct, reverse, related: [...new Set([direct, ...reverse].filter(Boolean))] }
}

function isLocationTwoSided(definition, card) {
  return Boolean(definition.unrevealed) && Boolean(card.backNameZh || card.backName)
}

// ---------------------------------------------------------------------------
// 范围与登记身份（先跑；失败时后面的逐卡断言没有意义）
// ---------------------------------------------------------------------------
test('TCU 战役卡范围：237 张主卡与 34 个关联面，三包分区唯一', () => {
  assert.equal(mainCards.length, 343)
  assert.equal(faceCards.length, 34)
  assert.equal(campaignCards.length, 237)
  assert.equal(CAMPAIGN_CARD_CODES.length, 237)
  assert.deepEqual([...campaignCards.map(card => card.code)].sort(), [...CAMPAIGN_CARD_CODES].sort())
  assert.equal(PENDING_TCU_CAMPAIGN_CODES.length, 0)
  assert.ok(PENDING_TCU_CAMPAIGN_CODES.every(code => campaignCodes.has(code)))

  const partitions = mainCards.map(card => [
    tcuInvestigatorCardVerified(card.code),
    tcuPlayerCardVerified(card.code),
    campaignCodes.has(card.code),
  ].filter(Boolean).length)
  assert.ok(partitions.every(count => count === 1), '主卡必须且只能属于一个分区')
  assert.equal(mainCards.filter(card => tcuInvestigatorCardVerified(card.code)).length, 19)
  assert.equal(mainCards.filter(card => tcuPlayerCardVerified(card.code)).length, 87)
  assert.equal(mainCards.filter(card => campaignCodes.has(card.code)).length, 237)
  assert.equal(new Set([...mainCards, ...faceCards].map(card => card.code)).size, 377)
})

test('TCU 九章 definition 与 behavior 全部注册到运行组合根，且身份是真实章节', () => {
  assert.equal(scenarioIds.length, 9)
  assert.deepEqual([...scenarioIds].sort(), Object.keys(definitionModules).sort())
  for (const id of scenarioIds) {
    const definitionModule = definitionModules[id]
    const behaviorModule = behaviorModules[id]
    assert.ok(definitionModule, id)
    assert.ok(behaviorModule, id)
    assert.equal(definitionModule.scenario.id, id)
    assert.equal(behaviorModule.behavior.id, id)
    // registry 暴露的必须是同一份模块实例（不是占位/复制）。
    assert.equal(contentRegistry.getScenarioData(id), definitionModule.scenario)
    assert.equal(contentRegistry.getBehavior(id), behaviorModule.behavior)
    assert.ok(Object.values(contentRegistry.getBehavior(id)).some(value => typeof value === 'function'),
      `${id} behavior 没有任何运行钩子`)
  }
})

// ---------------------------------------------------------------------------
// 战役主卡：237 张逐卡字面验收
// ---------------------------------------------------------------------------
for (const card of campaignCards) {
  const status = pending.has(card.code) ? '待实现' : '已验收'
  test(`TCU ${card.code} ${status} · ${card.type} 卡文与关卡定义`, () => {
    assert.equal(card.dataStatus, 'validated')
    assert.ok(card.encounterCode, `${card.code} 缺少遭遇组归属`)
    const cardName = localized(card, 'name')
    assert.ok(cardName, `${card.code} 缺少卡名`)
    assert.ok(localized(card, 'text') || localized(card, 'backText') || localized(card, 'flavor'),
      `${card.code} 缺少卡面文本`)
    assert.equal(represented(card.code), true, `${card.code} 没有进入任何万象无终运行表面`)

    if (card.type === 'scenario') {
      // 剧本参考卡：实现就是该章的 definition/behavior，没有单独卡面定义。
      const scenario = scenarioForCode(card.code)
      assert.ok(scenario, `${card.code} 没有对应的章节数据`)
      assert.ok(scenarioIds.includes(scenario.id), `${card.code} 的章节不在战役流程里`)
      const manifest = contentRegistry.getScenario(scenario.id)
      assert.equal(manifest.campaignId, 'theCircleUndone')
      assert.equal(manifest.id, scenario.id)
      assert.ok(manifest.behaviorIds.includes(scenario.id),
        `${card.code} 章节 manifest 没有绑定本章 behavior`)
      assert.match(localized(card, 'text'), /./)
      assert.ok(String(scenario.name).endsWith(cardName), `${card.code} 章节名与卡名不一致`)
      const hooks = Object.values(contentRegistry.getBehavior(scenario.id))
        .filter(value => typeof value === 'function')
      assert.ok(hooks.length >= 3, `${card.code} 章节行为钩子不足：${hooks.length}`)
      assert.equal(tcuCampaignCardVerified(card.code), true)
      return
    }

    if (card.type === 'investigator') {
      // 序章故事调查员：4 张无牌组调查员，能力在 investigatorRule 条目，设置数据在 definition 模块导出里。
      const prologue = scenarioData.find(scenario => scenario.id === 'disappearanceAtTheTwilightEstate')
      assert.ok(prologue.storyInvestigators?.codes?.includes(card.code),
        `${card.code} 不在序章故事调查员配置里`)
      assert.ok(disappearanceAtTheTwilightEstateDefinition.STORY_INVESTIGATOR_SETUP?.[card.code],
        `${card.code} 缺少 STORY_INVESTIGATOR_SETUP 设置数据`)
      assert.equal(investigatorRule(card.code)?.code ?? card.code, card.code,
        `${card.code} 缺少调查员行为读点`)
      assert.equal(tcuInvestigatorCardVerified(card.code), false,
        `${card.code} 是序章故事调查员，不应混入正式调查员包`)
      assert.ok(behaviorSurface.includes('storyInvestigators') || behaviorSurface.includes('setupEnemies'),
        '序章故事调查员的设置行为没有进入运行表面')
      assert.equal(tcuCampaignCardVerified(card.code), true)
      return
    }

    assert.equal(tcuCampaignCardVerified(card.code), true,
      `${card.code} 未被战役包声明为已实现`)
    assert.ok(behaviorLinked(card.code), `${card.code} 缺少逐卡行为读点`)

    const definition = definitionFor(card.code)
    assert.ok(definition, `${card.code} 在 9 章 definition 中找不到卡面定义`)
    assert.equal(definition.originalCode, card.code)

    // 名称：双面地点在定义里存的是**未揭示面**（破旧房门/未知地点），揭示面名在 unrevealed。
    if (definition.name !== cardName) {
      assert.equal(card.type, 'location', `${card.code} 名称不一致：${definition.name} / ${cardName}`)
      assert.ok(isLocationTwoSided(definition, card),
        `${card.code} 名称不一致且不是双面地点：定义=${definition.name} 卡面=${cardName}`)
      assert.equal(definition.name, card.backNameZh || card.backName)
      assert.equal(definition.unrevealed.nameZh, cardName)
    }
    // 卡文：定义.text 必须逐字等于印刷正面文本（act/agenda/location 允许正面无文本，由背面推进文本承载）。
    assert.equal(definition.text ?? '', localized(card, 'text'),
      `${card.code} 卡文与 definition 不一致`)

    if (card.type === 'enemy') {
      assert.equal(definition.fight, card.fight ?? 0, `${card.code} fight`)
      assert.equal(definition.evade, card.evade ?? 0, `${card.code} evade`)
      assert.equal(definition.health, card.health ?? 1, `${card.code} health`)
      assert.equal(definition.damage, card.damage ?? 0, `${card.code} damage`)
      assert.equal(definition.horror, card.horror ?? 0, `${card.code} horror`)
      assert.equal(Boolean(definition.healthPerInvestigator), Boolean(card.healthPerInvestigator),
        `${card.code} healthPerInvestigator 标记不一致`)
      if (card.healthPerInvestigator) {
        assert.equal(definition.healthPerInvestigator, card.health, `${card.code} healthPerInvestigator`)
      }
      assert.equal(definition.rulesPending, false, `${card.code} 仍标记 rulesPending`)
    }
    if (card.type === 'treachery') {
      assert.equal(definition.rulesPending, false, `${card.code} 仍标记 rulesPending`)
      assert.deepEqual(definition.effect, { kind: 'campaignRule' })
    }
    if (card.type === 'location') {
      if ((card.shroud ?? 0) < 0) {
        // 卡面把隐藏值印成 X（扫描拿不到 → -2 占位）：定义归零并用 shroudRule 计算。
        assert.equal(definition.shroud, 0, `${card.code} 隐藏值占位应有 definition.shroud=0`)
        assert.equal(typeof definition.shroudRule, 'string', `${card.code} 缺少 shroudRule`)
        assert.match(localized(card, 'text'), /X/, `${card.code} 印刷文本没有声明隐藏值 X`)
      } else {
        assert.equal(definition.shroud, card.shroud ?? 0, `${card.code} shroud`)
      }
      assert.equal(definition.cluesPerInvestigator ?? 0, card.clues || 0, `${card.code} clues`)
      assert.equal(definition.victory ?? 0, card.victory || 0, `${card.code} victory`)
      assert.ok(definition.connections || definition.symbols || definition.explicitConnections,
        `${card.code} 地点定义没有任何连接数据`)
    }
    if (card.type === 'agenda') {
      assert.equal(definition.doomThreshold ?? null, card.doom ?? null, `${card.code} doomThreshold`)
      assert.equal(definition.advanceText ?? '', localized(card, 'backText'),
        `${card.code} 议程推进文本与 definition.advanceText 不一致`)
    }
    if (card.type === 'act') {
      assert.equal(definition.advanceText ?? '', localized(card, 'backText'),
        `${card.code} 幕推进文本与 definition.advanceText 不一致`)
    }
    if (['act', 'agenda'].includes(card.type)) {
      assert.equal(definition.backText ?? '', localized(card, 'backText'),
        `${card.code} 背面文本与 definition.backText 不一致`)
      // 单面幕（例如 05055《通向曙光》）没有背面推进文本：卡面本身必须提供规则文本。
      if (localized(card, 'backText')) {
        assert.ok(definition.advanceText, `${card.code} 有背文但 definition.advanceText 为空`)
      } else {
        assert.ok(localized(card, 'text'), `${card.code} 正反面都没有规则文本`)
      }
    }
    if (['asset', 'story'].includes(card.type)) {
      assert.ok(['asset', 'story'].includes(definition.type),
        `${card.code} 剧情/资产定义类型异常：${definition.type}`)
    }
  })
}

// ---------------------------------------------------------------------------
// 34 个关联面：归到主卡（或成对关联面）后取主卡定义/行为链接作证据
// ---------------------------------------------------------------------------
for (const card of faceCards) {
  const relation = faceRelation(card.code)
  const partnerLabel = relation.related.join('+') || '未链接'
  test(`TCU ${card.code} 已验收 · 关联面 ${partnerLabel}`, () => {
    assert.equal(card.dataStatus, 'validated')
    assert.ok(localized(card, 'name'), `${card.code} 缺少卡名`)
    assert.ok(localized(card, 'text') || localized(card, 'backText') || localized(card, 'flavor'),
      `${card.code} 缺少卡面文本`)
    assert.equal(relation.related.length, 1,
      `${card.code} 关联面必须恰好链接一个主卡/成对关联面：${relation.related.join(',')}`)
    const partner = relation.related[0]
    assert.ok(ALL_CARDS[partner], `${card.code} 的关联卡不存在：${partner}`)
    const mainPartner = campaignCodes.has(partner) ? partner : null
    const facePartner = /^05\d{3}[a-z]$/.test(partner) ? partner : null
    assert.ok(mainPartner || facePartner, `${card.code} 关联面没有归到战役主卡或成对关联面：${partner}`)
    assert.equal(represented(card.code), true, `${card.code} 没有进入任何万象无终运行表面`)

    const definition = definitionFor(card.code)
    if (definition) {
      // 关联面自己的定义（异端者/命运敌人/女巫圆环/约瑟夫的计划/变体幕等）也必须字面一致。
      assert.equal(definition.name, localized(card, 'name'), `${card.code} 关联面定义名称不一致`)
      assert.equal(definition.text ?? '', localized(card, 'text'), `${card.code} 关联面定义卡文不一致`)
    }

    if (mainPartner) {
      const main = ALL_CARDS[mainPartner]
      assert.equal(Boolean(card.linkedCardCode === mainPartner || main.linkedCardCode === card.code), true,
        `${card.code} 与主卡 ${mainPartner} 没有双向关联字段`)
      const mainDefinition = definitionFor(mainPartner)
      assert.ok(mainDefinition, `${card.code} 的主卡 ${mainPartner} 没有关卡定义`)
      assert.equal(implementedFor(mainPartner), true,
        `${card.code} 的主卡 ${mainPartner} 缺少行为读点`)
      assert.ok(definition || JSON.stringify(mainDefinition).includes(`"${card.code}"`),
        `${card.code} 既无自身定义，也没有出现在主卡 ${mainPartner} 的定义里`)
    } else {
      const partnerCard = ALL_CARDS[facePartner]
      assert.equal(partnerCard.linkedCardCode === card.code || card.linkedCardCode === partnerCard.code,
        true, `${card.code} 与成对关联面 ${facePartner} 没有双向关联`)
      assert.ok(definition || definitionFor(facePartner),
        `${card.code} 与成对关联面 ${facePartner} 都没有定义`)
      assert.equal(Boolean(implementedFor(card.code) || implementedFor(facePartner)), true,
        `${card.code} 与成对关联面 ${facePartner} 都没有行为读点`)
    }
    assert.equal(Boolean(implementedFor(card.code) || (mainPartner && implementedFor(mainPartner))), true,
      `${card.code} 关联面没有任何逐卡行为证据`)
    assert.ok(behaviorSurface.length > 0, 'behavior 运行面为空')
  })
}

// ---------------------------------------------------------------------------
// 收尾：卡面数据与 definition 的跨章一致性（同一张共享卡在多章定义里必须同值）
// ---------------------------------------------------------------------------
test('TCU 跨章共享卡的 definition 印刷字段一致（同名/同文/同数值）', () => {
  const fields = ['name', 'text', 'fight', 'evade', 'health', 'damage', 'horror', 'shroud',
    'cluesPerInvestigator', 'doomThreshold', 'advanceText']
  let compared = 0
  for (const card of campaignCards) {
    if (['scenario', 'investigator'].includes(card.type)) continue
    const candidates = definitionCandidates(card.code)
    if (candidates.length < 2) continue
    compared++
    const primary = definitionFor(card.code)
    for (const definition of candidates) {
      if (definition === primary) continue
      for (const field of fields) {
        if (!(field in primary) && !(field in definition)) continue
        assert.deepEqual(definition[field], primary[field],
          `${card.code} 的 ${field} 在跨章 definition 中不一致`)
      }
    }
  }
  assert.ok(compared > 0, '没有任何跨章共享卡可比较，口径失效')
})

// ---------------------------------------------------------------------------
// 类型覆盖：所有战役卡类型都有逐字段核对分支，不存在静默跳过的类型
// ---------------------------------------------------------------------------
test('TCU 战役卡类型全部有验收分支，不存在未支持类型', () => {
  const expected = new Set(['scenario', 'investigator', 'enemy', 'treachery', 'location', 'act',
    'agenda', 'asset', 'story'])
  const actual = new Set(campaignCards.map(card => card.type))
  assert.deepEqual([...actual].sort(), [...expected].sort())
  const faceTypes = new Set(faceCards.map(card => card.type))
  for (const type of faceTypes) {
    assert.ok(['location', 'enemy', 'story', 'act'].includes(type), `未支持的关联面类型：${type}`)
  }
})
