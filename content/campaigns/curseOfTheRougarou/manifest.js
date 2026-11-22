// 狼人诅咒（Curse of the Rougarou · 81001）· 独立单章战役清单。
//
// 参考（权威）：
//   Scenario/Scenarios/CurseOfTheRougarou.hs（setup / 混乱袋 / 结局）+ Arkham/SideStory.hs（插入费用 81001=1）
//   frontend/src/arkham/data/side-stories.json（独立难度 Standard/Hard 与袋内标记）
//   frontend/src/locales/en/standalone/curseOfTheRougarou.json（intro/setup/resolutions）
//
// 本战役是「独立单章战役」：opening 声明起始构筑预算（= side-stories.json 的 xp 字段：每人 1 XP，
// 与插入主战役时的费用同额；该口径由批次 2 Lead 裁决）；chaosBags 只声明 standard / hard 两档
// （参考只开放 Standard/Hard 独立难度）。flow: start → scenario → decision(aftermath) → end。
// 插入主战役的入口不写在这里（由 Lead 的 sideStory flow 节点 + 主战役 sideStories 声明实现）。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

// side-stories.json 的 81001 难度袋（Standard/Hard 逐字转成引擎 token 字符串）。
export const CHAOS_BAGS = Object.freeze({
  standard: Object.freeze([
    '+1', '+1', '0', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-4', '-5', '-6',
    'skull', 'skull', 'cultist', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  hard: Object.freeze([
    '+1', '0', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-4', '-5', '-5', '-6', '-8',
    'skull', 'skull', 'skull', 'cultist', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
})

// 战役日志记录键（参考 CampaignLogKey：TheRougarouContinuesToHauntTheBayou /
// TheRougarouIsDestroyed / TheRougarouEscapedAndYouEmbracedTheCurse；Remembered：
// FoundAnAncientBindingStone / FoundAStrangeDoll）。
export const RECORD_TYPES = Object.freeze({
  theRougarouContinuesToHauntTheBayou: 'boolean',
  theRougarouIsDestroyed: 'boolean',
  theRougarouEscapedAndYouEmbracedTheCurse: 'boolean',
  foundAnAncientBindingStone: 'boolean',
  foundAStrangeDoll: 'boolean',
})

export const RECORD_LABELS = Object.freeze({
  theRougarouContinuesToHauntTheBayou: '狼人继续在河口出没',
  theRougarouIsDestroyed: '狼人已被消灭，诅咒已解除',
  theRougarouEscapedAndYouEmbracedTheCurse: '狼人逃走，你拥抱了诅咒',
  foundAnAncientBindingStone: '调查员找到一块古代束缚之石',
  foundAStrangeDoll: '调查员找到一个奇怪的玩偶',
})

export const SCENARIO_ID = 'curseOfTheRougarou'

// 独立开局：参考 side-stories.json 的 xp 字段 = 1（与插入费用同额，作为起始构筑预算）。
export const OPENING_EXPERIENCE = 1

export const manifest = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'curseOfTheRougarou',
  name: '狼人诅咒',
  nameEn: 'Curse of the Rougarou',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  requiredPackIds: ['core', 'cotrCampaign'],
  opening: Object.freeze({ experience: OPENING_EXPERIENCE }),
  scenarioIds: Object.freeze([SCENARIO_ID]),
  unlock: Object.freeze({ [SCENARIO_ID]: Object.freeze([]) }),
  chaosBags: CHAOS_BAGS,
  recordSchema: RECORD_TYPES,
  recordLabels: RECORD_LABELS,
  interludeHandlerId: 'curseOfTheRougarouInterlude',
  resolutionIds: Object.freeze(['noResolution', 'resolution1', 'resolution2', 'resolution3']),
  // 单章支线：唯一关卡 → 结局决策节点 → 战役结束。
  // decision 节点按剧本结局（resolution 条件）给出「记录结局并结束支线」的选项；
  // 记录/奖励/创伤本身由场景 behavior.resolution 的声明式 effects 结算（在进入本节点前已写入）。
  flow: Object.freeze({
    start: SCENARIO_ID,
    nodes: Object.freeze({
      [SCENARIO_ID]: Object.freeze({ type: 'scenario', scenarioId: SCENARIO_ID, next: 'aftermath' }),
      aftermath: Object.freeze({
        type: 'choice',
        options: Object.freeze([
          Object.freeze({
            id: 'recordedHaunting', label: '记录「狼人继续在河口出没」，结束支线',
            when: Object.freeze({ resolution: Object.freeze({ scenarioId: SCENARIO_ID, value: 'resolution1' }) }),
            next: 'end',
          }),
          Object.freeze({
            id: 'recordedDestroyed', label: '记录「狼人已被消灭，诅咒解除」，结束支线',
            when: Object.freeze({ resolution: Object.freeze({ scenarioId: SCENARIO_ID, value: 'resolution2' }) }),
            next: 'end',
          }),
          Object.freeze({
            id: 'recordedEmbraced', label: '记录「狼人逃走，你拥抱了诅咒」，结束支线',
            when: Object.freeze({ resolution: Object.freeze({ scenarioId: SCENARIO_ID, value: 'resolution3' }) }),
            next: 'end',
          }),
          Object.freeze({
            id: 'recordedRetreat', label: '全员撤退：按结局 1 记录，结束支线',
            when: Object.freeze({ resolution: Object.freeze({ scenarioId: SCENARIO_ID, value: 'noResolution' }) }),
            next: 'end',
          }),
        ]),
      }),
      end: Object.freeze({ type: 'end' }),
    }),
  }),
})

// 兼容旧战役引擎的形状。
export const CAMPAIGN = Object.freeze({
  id: manifest.id, name: manifest.name, nameEn: manifest.nameEn, scenarioOrder: manifest.scenarioIds,
})

export default manifest
