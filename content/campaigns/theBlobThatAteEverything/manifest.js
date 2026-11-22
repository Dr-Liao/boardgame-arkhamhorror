// 吞噬万物（The Blob That Ate Everything · 85001）· 独立支线战役清单（普通流程 + ELSE! 变体）。
//
// 参考（权威）：
//   Scenario/Scenarios/TheBlobThatAteEverything.hs（Setup / 双层环布置 / 混乱袋 / 结局 / ELSE 选项）
//   Act|Agenda|Location|Enemy|Treachery|Story/CardDefs/TheBlobThatAteEverything*.hs
//   frontend/src/arkham/data/side-stories.json（85001: epicMultiplayer、returnToVariant、xp 2、Standard/Hard）
//   frontend/src/locales/en/standalone/theBlobThatAteEverything.json（intro/setup/specialRules/resolutions）
//
// 设计口径：
//   · 普通流程 = 单桌（Single Group）85001 关卡；ELSE! 变体 = 89005+ 的独立关卡
//     `theBlobThatAteEverythingElse`（Lead 已注册 `theBlobThatAteEverythingElse` 遭遇组）。
//   · 开局台面 choice 节点同时提供「普通流程 / ELSE! 变体」两个入口（initialHubScenarioMoves 读点）；
//     普通流程 R2 之后还可从关间决策进入 ELSE! 变体（side-stories.json returnToVariant）。
//   · epic multiplayer（跨桌、全局血量/反制措施池）不在本文件实现，见 artifacts primitive-requests。
//   · opening.experience = side-stories.json 的 xp 字段（85001 = 2）。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

export const CHAOS_BAGS = Object.freeze({
  standard: Object.freeze([
    '+1', '0', '0', '0', '-1', '-2', '-2', '-3', '-4', '-5',
    'skull', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
  hard: Object.freeze([
    '0', '0', '0', '-1', '-1', '-2', '-3', '-4', '-5', '-6',
    'skull', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'eldersign',
  ]),
})

export const RECORD_TYPES = Object.freeze({
  subject8L08DevouredTheEntireUniverse: 'boolean',
  theAnomalyWasContained: 'boolean',
  elsePlayed: 'boolean',
  youHaveNoSoul: 'boolean',
})

export const RECORD_LABELS = Object.freeze({
  subject8L08DevouredTheEntireUniverse: '个体代号8L-08吞噬了整个宇宙',
  theAnomalyWasContained: '异变体已被收容',
  elsePlayed: '已游玩 ELSE! 变体',
  youHaveNoSoul: '你没有灵魂',
})

export const SCENARIO_ID = 'theBlobThatAteEverything'
export const ELSE_SCENARIO_ID = 'theBlobThatAteEverythingElse'
export const OPENING_EXPERIENCE = 2

const RESOLUTION = (scenarioId, value) => Object.freeze({ resolution: Object.freeze({ scenarioId, value }) })
const NORMAL_R2 = RESOLUTION(SCENARIO_ID, 'resolution2')
const NOT = condition => Object.freeze({ not: condition })
const ALL = (...conditions) => Object.freeze({ all: Object.freeze([...conditions]) })

export const manifest = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'theBlobThatAteEverything',
  sideStory: true,
  name: '吞噬万物',
  nameEn: 'The Blob That Ate Everything',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  requiredPackIds: ['core', 'blobCampaign'],
  opening: Object.freeze({ experience: OPENING_EXPERIENCE }),
  scenarioIds: Object.freeze([SCENARIO_ID, ELSE_SCENARIO_ID]),
  unlock: Object.freeze({ [SCENARIO_ID]: Object.freeze([]), [ELSE_SCENARIO_ID]: Object.freeze([]) }),
  chaosBags: CHAOS_BAGS,
  recordSchema: RECORD_TYPES,
  recordLabels: RECORD_LABELS,
  interludeHandlerId: 'theBlobThatAteEverythingInterlude',
  resolutionIds: Object.freeze(['noResolution', 'resolution1', 'resolution2']),
  flow: Object.freeze({
    start: 'selectVariant',
    nodes: Object.freeze({
      // 开局台面：两套流程都可直接进入（side-stories.json returnToVariant 的入口）。
      selectVariant: Object.freeze({
        type: 'choice',
        options: Object.freeze([
          Object.freeze({
            id: 'playNormal', label: '普通流程：The Blob That Ate Everything（单桌）',
            next: SCENARIO_ID,
          }),
          Object.freeze({
            id: 'playElse', label: 'ELSE! 变体：The Blob That Ate Everything Else（89005+）',
            next: ELSE_SCENARIO_ID,
          }),
        ]),
      }),
      [SCENARIO_ID]: Object.freeze({ type: 'scenario', scenarioId: SCENARIO_ID, next: 'normalAftermath' }),
      normalAftermath: Object.freeze({
        type: 'choice',
        options: Object.freeze([
          Object.freeze({
            id: 'elseVariant', label: '继续游玩 ELSE! 变体（重置内容并加入 89005+ 卡牌）',
            when: ALL(NORMAL_R2, NOT(Object.freeze({ hasRecord: Object.freeze({ key: 'elsePlayed' }) }))),
            effects: Object.freeze([Object.freeze({ type: 'record', key: 'elsePlayed', value: true })]),
            next: ELSE_SCENARIO_ID,
          }),
          Object.freeze({
            id: 'recordedUniverseDevoured', label: '记录「个体代号8L-08吞噬了整个宇宙」，结束支线',
            when: RESOLUTION(SCENARIO_ID, 'resolution1'), next: 'end',
          }),
          Object.freeze({
            id: 'recordedAnomalyContained', label: '记录「异变体已被收容」，结束支线',
            when: NORMAL_R2, next: 'end',
          }),
          Object.freeze({
            id: 'recordedNoResolution', label: '没有达成任何结局，结束支线',
            when: RESOLUTION(SCENARIO_ID, 'noResolution'), next: 'end',
          }),
        ]),
      }),
      [ELSE_SCENARIO_ID]: Object.freeze({ type: 'scenario', scenarioId: ELSE_SCENARIO_ID, next: 'elseAftermath' }),
      elseAftermath: Object.freeze({
        type: 'choice',
        options: Object.freeze([
          Object.freeze({
            id: 'elseUniverseDevoured', label: '记录「个体代号8L-08吞噬了整个宇宙」，结束支线',
            when: RESOLUTION(ELSE_SCENARIO_ID, 'resolution1'), next: 'end',
          }),
          Object.freeze({
            id: 'elseAnomalyContained', label: '记录「异变体已被收容」，结束支线',
            when: RESOLUTION(ELSE_SCENARIO_ID, 'resolution2'), next: 'end',
          }),
          Object.freeze({
            id: 'elseNoResolution', label: '没有达成任何结局，结束支线',
            when: RESOLUTION(ELSE_SCENARIO_ID, 'noResolution'), next: 'end',
          }),
        ]),
      }),
      end: Object.freeze({ type: 'end' }),
    }),
  }),
})

export const CAMPAIGN = Object.freeze({
  id: manifest.id, name: manifest.name, nameEn: manifest.nameEn, scenarioOrder: manifest.scenarioIds,
})

export default manifest
