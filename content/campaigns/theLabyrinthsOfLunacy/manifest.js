// 《疯狂迷宫》（The Labyrinths of Lunacy · 70001）· 独立支线战役清单。
//
// 参考（权威）：
//   Scenario/Scenarios/TheLabyrinthsOfLunacy.hs（Setup / group meta / resolutionKey / chooseGroup）
//   frontend/src/locales/en/standalone/theLabyrinthsOfLunacy.json（intro/setup/resolutions/tokens）
//   frontend/src/arkham/data/side-stories.json：epicMultiplayer / miniCampaign / xp=2 / 难度袋
//
// 一个场景、三种单桌等价模式（Group A / B / C）：epic multiplayer 的三桌同步由 Lead 的跨桌引擎提供；
// 本地先实现「单桌普通流程 + 三组数据与行为」。mini-campaign 的三次连续游戏用 manifest 元数据
// （miniCampaign / epicMultiplayer.groups）表达，单桌流程为 1 章（其余两组的重开由跨桌/重开流程接线）。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'

export const CAMPAIGN_ID = 'theLabyrinthsOfLunacy'
export const SCENARIO_ID = 'theLabyrinthsOfLunacy'

// side-stories.json difficultyLevels → 引擎 chaos token 字符串（同 TheLabyrinthsOfLunacy.hs 的
// standardTokens / hardTokens）。组标记在 Setup 时各加 2 枚（A=elderthing / B=tablet / C=cultist）。
export const CHAOS_BAGS = Object.freeze({
  standard: Object.freeze([
    '+1', '0', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-4', '-5',
    'skull', 'skull', 'autofail', 'eldersign',
  ]),
  hard: Object.freeze([
    '+1', '0', '-1', '-1', '-1', '-2', '-2', '-2', '-3', '-4', '-5', '-6',
    'skull', 'skull', 'autofail', 'eldersign',
  ]),
})

// 三组结局写回战役记录（参考 Key.hs 的 GroupA/B/C GroupOutcome；本战役无正式 Campaign Log，
// 记录只服务 mini-campaign 的组顺序/结局与重开判断）。
export const RECORD_TYPES = Object.freeze({
  currentGroup: 'string',
  miniCampaign: 'boolean',
  playedGroups: 'string[]',
  escapedGroups: 'string[]',
  theGroupPerished: 'string[]',
  groupAOutcome: 'string',
  groupBOutcome: 'string',
  groupCOutcome: 'string',
})

export const RECORD_LABELS = Object.freeze({
  currentGroup: '当前被困的组',
  miniCampaign: '以迷你战役进行',
  playedGroups: '已进行过的组',
  escapedGroups: '逃出迷宫的组',
  theGroupPerished: '覆灭的组',
  groupAOutcome: 'A 组结局',
  groupBOutcome: 'B 组结局',
  groupCOutcome: 'C 组结局',
})

export const manifest = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: CAMPAIGN_ID,
  name: '疯狂迷宫',
  nameEn: 'The Labyrinths of Lunacy',
  contentVersion: '0.1.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  requiredPackIds: Object.freeze(['core', 'lolCampaign']),
  // side-stories.json 的 xp=2（独立模式构筑经验）。
  opening: Object.freeze({ experience: 2 }),
  scenarioIds: Object.freeze([SCENARIO_ID]),
  unlock: Object.freeze({ [SCENARIO_ID]: Object.freeze([]) }),
  chaosBags: CHAOS_BAGS,
  recordSchema: RECORD_TYPES,
  recordLabels: RECORD_LABELS,
  interludeHandlerId: 'theLabyrinthsOfLunacyInterlude',
  resolutionIds: Object.freeze(['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4']),
  // epic multiplayer / mini-campaign 元数据（side-stories.json：epicMultiplayer=true, miniCampaign=true）。
  epicMultiplayer: Object.freeze({
    enabled: true, tables: 3, groups: Object.freeze(['A', 'B', 'C']),
    scenarioPerGroup: 1, sharedScenarioId: SCENARIO_ID,
  }),
  miniCampaign: Object.freeze({ enabled: true, sessions: 3, freeGroupOrder: true, sessionsShareScenarioId: SCENARIO_ID }),
  flow: Object.freeze({
    start: 'labyrinth',
    nodes: Object.freeze({
      labyrinth: Object.freeze({ type: 'scenario', scenarioId: SCENARIO_ID, next: 'aftermath' }),
      // 单桌流程：本组结算后结束支线；mini-campaign 的「以另一组继续」由跨桌/重开流程接线。
      aftermath: Object.freeze({
        type: 'choice',
        options: Object.freeze([
          Object.freeze({ id: 'finish', label: '结束本次迷宫（记录本组结局）', next: 'end' }),
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
