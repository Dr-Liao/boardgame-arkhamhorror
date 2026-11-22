// 读书至死（Read or Die · 90004）· 独立单章战役清单。
//
// 参考（权威）：
//   Scenario/Scenarios/ReadOrDie.hs（setup / 混乱袋 / 结局）；
//   Arkham/SideStory.hs（challengeScenarioInvestigator：90004 → Daisy Walker；
//     getSideStoryCost 90004 = 3，指定调查员支付全额、其他调查员 1 XP —— 这是「插入主战役」的费用口径）；
//   frontend/src/arkham/data/side-stories.json（90004：requiredInvestigator=Daisy Walker、
//     deckRequirements=「Daisy Walker's deck must include at least 4 non-weakness Tome assets.」、
//     standaloneDifficulties=Easy/Standard/Hard/Expert、xp=3）。
//
// 本战役是「独立单章挑战战役」：opening 声明起始构筑经验（= side-stories.json 的 xp 字段 3，
// 与战役插入费用同额；批次 2 Lead 裁决独立开局按 xp 验收），chaosBags 只声明 standard / hard
// 两档（本 Mod 独立难度只开放 Standard/Hard；参考的 Easy/Expert 隐藏，见 dossier）。
//
// 调查员限制：参考只要求 Daisy Walker 必须作为调查员之一；本 Mod 的 opening.investigators
// 语义是「唯一可选调查员」，因此本批只交付 1P 单开路径（多人局 2P 选人留批次 4）。
// flow: start → scenario → end（单章挑战，结算即战役结束）。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { KEY_INVESTIGATOR } from './scenarios/readOrDie/definition.js'

// side-stories.json 90004 的 Standard/Hard 袋（逐字转成引擎 token 字符串）。
export const CHAOS_BAGS = Object.freeze({
  easy: Object.freeze([
    '+1', '+1', '0', '0', '0', '-1', '-1', '-1', '-2', '-2',
    'skull', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  standard: Object.freeze([
    '+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-4',
    'skull', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  hard: Object.freeze([
    '0', '0', '-1', '-1', '-2', '-2', '-3', '-4', '-5', '-6',
    'skull', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  expert: Object.freeze([
    '0', '-1', '-2', '-3', '-4', '-5', '-6', '-7', '-8',
    'skull', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
})

// 战役记录：挑战剧本参考没有额外 campaign log 项；这两个键是本 Mod 结局面板/验收读点
// （结局 id 与游戏结束时黛西场上的书卷数），写入在 behavior.resolution 的声明式效果里。
export const RECORD_TYPES = Object.freeze({
  readOrDieResolution: 'string',
  readOrDieTomesInPlay: 'number',
})

export const RECORD_LABELS = Object.freeze({
  readOrDieResolution: '读书至死结局',
  readOrDieTomesInPlay: '结局时场上书卷数量',
})

export const SCENARIO_ID = 'readOrDie'

// 独立开局：参考 side-stories.json 的 xp 字段 = 3（与插入费用同额，作为起始构筑经验）。
export const OPENING_EXPERIENCE = 3

export const manifest = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'readOrDie',
  name: '读书至死',
  nameEn: 'Read or Die',
  contentVersion: '0.1.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  requiredPackIds: ['core', 'rodCampaign'],
  // 独立开局：起始构组经验 3；本批唯一可选调查员＝平行黛西·沃克（1P 单开路径）。
  opening: Object.freeze({ experience: OPENING_EXPERIENCE, investigators: Object.freeze([KEY_INVESTIGATOR]) }),
  scenarioIds: Object.freeze([SCENARIO_ID]),
  unlock: Object.freeze({ [SCENARIO_ID]: Object.freeze([]) }),
  chaosBags: CHAOS_BAGS,
  recordSchema: RECORD_TYPES,
  recordLabels: RECORD_LABELS,
  interludeHandlerId: 'readOrDieInterlude',
  resolutionIds: Object.freeze(['noResolution', 'resolution1', 'resolution2']),
  flow: Object.freeze({
    start: SCENARIO_ID,
    nodes: Object.freeze({
      [SCENARIO_ID]: Object.freeze({ type: 'scenario', scenarioId: SCENARIO_ID, next: 'end' }),
      end: Object.freeze({ type: 'end' }),
    }),
  }),
})

// 兼容旧战役引擎的形状。
export const CAMPAIGN = Object.freeze({
  id: manifest.id, name: manifest.name, nameEn: manifest.nameEn, scenarioOrder: manifest.scenarioIds,
})

export default manifest
