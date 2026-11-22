// 批次 2：「重返夜之狂热」战役（参考战役 50）。
//
// 与基础《夜之狂热》共用剧情结构、混乱袋与战役记录字段；三章为「重返」变体
// （见 scenarios/<returnToXxx>/），默认弱点池通过 requiredPackIds 引入已注册的
// `rtnotzPlayer` 玩家包（includeInAutomaticWeaknessPool），开局配置沿用基础袋。
import { CHAOS_BAGS } from '../nightOfTheZealot/shared.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { RESEARCH_RECORD_LABELS, RESEARCH_RECORD_TYPES } from '../research-records.js'

export const manifest = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'returnToNightOfTheZealot',
  name: '重返夜之狂热',
  nameEn: 'Return to the Night of the Zealot',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  // rtnotzPlayer 提供重返盒玩家卡与默认弱点池（本盒没有基础弱点，池保持核心基础弱点）；
  // rtnotzCampaign 提供 50xxx 非玩家卡（战役第五章的遭遇组）。
  requiredPackIds: ['core', 'notz', 'rtnotzCampaign', 'rtnotzPlayer'],
  scenarioIds: ['returnToTheGathering', 'returnToTheMidnightMasks', 'returnToTheDevourerBelow'],
  unlock: {
    returnToTheGathering: [],
    returnToTheMidnightMasks: ['returnToTheGathering'],
    returnToTheDevourerBelow: ['returnToTheMidnightMasks'],
  },
  // 开局配置：0 额外经验，不限制调查员；难度与混乱袋沿用基础《夜之狂热》。
  opening: { experience: 0 },
  // 批次 2：关间可插入的独立支线（每人支付 cost 经验；结算后回到原定下一章）。
  sideStories: [
    { campaignId: 'curseOfTheRougarou', cost: 1 },
    { campaignId: 'carnevaleOfHorrors', cost: 3 },
    { campaignId: 'murderAtTheExcelsiorHotel', cost: 3 },
  ],
  chaosBags: CHAOS_BAGS,
  flow: {
    start: 'gathering',
    nodes: {
      gathering: { type: 'scenario', scenarioId: 'returnToTheGathering', next: 'restOne' },
      restOne: { title: '集结后关间准备', type: 'interlude', next: 'masks' },
      masks: { type: 'scenario', scenarioId: 'returnToTheMidnightMasks', next: 'restTwo' },
      restTwo: { title: '午夜假面后关间准备', type: 'interlude', next: 'devourer' },
      devourer: { type: 'scenario', scenarioId: 'returnToTheDevourerBelow', next: 'end' },
      end: { type: 'end' },
    },
  },
  recordLabels: {
    ...RESEARCH_RECORD_LABELS,
    houseBurned: '房屋已烧毁', ghoulPriestAlive: '食尸鬼祭司仍存活', litaOwner: '丽塔所属调查员',
    litaForcedOthers: '丽塔不得不去找别的帮手', cultistsInterrogated: '已盘问异教徒', cultistsEscaped: '逃脱的异教徒',
    pastMidnight: '已过午夜', succumbedToUmordhoth: '屈服于乌默尔多斯', ritualBroken: '仪式已破坏',
    repelledUmordhoth: '已击退乌默尔多斯', sacrificedLita: '已牺牲丽塔',
  },
  recordSchema: {
    ...RESEARCH_RECORD_TYPES,
    houseBurned: 'boolean', ghoulPriestAlive: 'boolean', litaOwner: 'string',
    litaForcedOthers: 'boolean', cultistsInterrogated: 'string[]', cultistsEscaped: 'string[]',
    pastMidnight: 'boolean', succumbedToUmordhoth: 'boolean', ritualBroken: 'boolean',
    repelledUmordhoth: 'boolean', sacrificedLita: 'boolean',
  },
  interludeHandlerId: 'coreInterlude',
  resolutionIds: ['victory', 'defeat', 'survived'],
})

// Compatibility shape for the existing campaign engine and snapshots.
export const CAMPAIGN = Object.freeze({
  id: manifest.id, name: manifest.name, nameEn: manifest.nameEn,
  scenarioOrder: manifest.scenarioIds,
})
