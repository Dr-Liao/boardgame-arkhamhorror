import { CHAOS_BAGS } from './shared.js'
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { RESEARCH_RECORD_LABELS, RESEARCH_RECORD_TYPES } from '../research-records.js'

export const manifest = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'nightOfTheZealot',
  name: '夜之狂热',
  nameEn: 'Night of the Zealot',
  contentVersion: '1.0.0',
  minRulesVersion: 'n4.2',
  status: 'playable',
  requiredPackIds: ['core', 'notz'],
  scenarioIds: ['theGathering', 'theMidnightMasks', 'theDevourerBelow'],
  unlock: {
    theGathering: [],
    theMidnightMasks: ['theGathering'],
    theDevourerBelow: ['theMidnightMasks'],
  },
  chaosBags: CHAOS_BAGS,
  flow: {
    start: 'gathering',
    nodes: {
      gathering: { type: 'scenario', scenarioId: 'theGathering', next: 'restOne' },
      restOne: { title: '集结后关间准备', type: 'interlude', next: 'masks' },
      masks: { type: 'scenario', scenarioId: 'theMidnightMasks', next: 'restTwo' },
      restTwo: { title: '午夜假面后关间准备', type: 'interlude', next: 'devourer' },
      devourer: { type: 'scenario', scenarioId: 'theDevourerBelow', next: 'end' },
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
