import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { CHAOS_BAGS, chapters, recordLabels } from './shared.js'
import { RESEARCH_RECORD_LABELS, RESEARCH_RECORD_TYPES } from '../research-records.js'

const record = (key, value = true) => ({ type: 'record', key, value })
const completed = scenarioId => ({ completed: scenarioId })
const route = (condition, yes, no) => ({ type: 'branch', options: [
  { id: 'yes', when: condition, next: yes }, { id: 'no', when: { not: condition }, next: no },
] })

// The full route is registered, but not launchable until each chapter's rules
// and encounter effects pass acceptance. Registration does not open player cards.
export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION, id: 'theDunwichLegacy',
  name: '敦威治遗产', nameEn: 'The Dunwich Legacy', contentVersion: '1.0.0',
  minRulesVersion: 'n4.2', status: 'playable', requiredPackIds: ['core', 'dunwichCampaign'],
  scenarioIds: chapters.map(chapter => chapter.id),
  unlock: Object.fromEntries(chapters.map((chapter, i) => [chapter.id,
    i < 2 ? [] : i === 2 ? chapters.slice(0, 2).map(c => c.id) : [chapters[i - 1].id]])),
  chaosBags: CHAOS_BAGS, recordLabels: { ...recordLabels, ...RESEARCH_RECORD_LABELS },
  recordSchema: { ...Object.fromEntries(Object.keys(recordLabels).map(key => [key, 'boolean'])),
    ...RESEARCH_RECORD_TYPES, openingScenario: 'string',
    sacrificedToYogSothoth: 'string[]', broodEscapedIntoTheWild: 'number' },
  interludeHandlerId: 'dunwichInterlude', resolutionIds: ['victory', 'defeat', 'survived'],
  flow: {
    start: 'prologue', nodes: {
      prologue: { type: 'choice', title: '敦威治遗产 · 序章',
        text: '阿米蒂奇博士请你们寻找失踪的同事：莱斯教授最后出现在大学，而摩尔根博士去了四叶草俱乐部。',
        prompt: '先去哪里寻找失踪的学者？', options: [
          { id: 'university', label: '米斯卡塔尼克大学：课外活动', next: 'university', effects: [record('openingScenario', 'extracurricularActivity')] },
          { id: 'club', label: '四叶草俱乐部：百赌百胜', next: 'club', effects: [record('openingScenario', 'theHouseAlwaysWins')] },
        ] },
      university: { type: 'scenario', scenarioId: 'extracurricularActivity', next: 'afterUniversity' },
      club: { type: 'scenario', scenarioId: 'theHouseAlwaysWins', next: 'afterClub' },
      afterUniversity: route(completed('theHouseAlwaysWins'), 'armitagesFate', 'beforeClub'),
      afterClub: route(completed('extracurricularActivity'), 'armitagesFate', 'beforeUniversity'),
      beforeClub: { type: 'interlude', title: '前往四叶草俱乐部', next: 'club' },
      beforeUniversity: { type: 'interlude', title: '前往米斯卡塔尼克大学', next: 'university' },
      armitagesFate: route({ record: 'investigatorsWereUnconsciousForSeveralHours', equals: true }, 'armitageKidnapped', 'armitageRescued'),
      armitageKidnapped: { type: 'story', title: '幕间一：阿米蒂奇的命运',
        text: '昏迷耽误了调查。阿米蒂奇也被绑架了，你们必须继续追查。',
        effects: [record('drHenryArmitageWasKidnapped'), { type: 'experience', amount: 2 }], next: 'beforeMuseum' },
      armitageRescued: { type: 'story', title: '幕间一：阿米蒂奇的命运',
        text: '你们及时找到了阿米蒂奇。他愿意协助接下来的调查。',
        effects: [record('theInvestigatorsRescuedDrHenryArmitage'), { type: 'storyCard', code: '02040' }], next: 'beforeMuseum' },
      beforeMuseum: { type: 'interlude', title: '前往博物馆', next: 'museum' },
      museum: { type: 'scenario', scenarioId: 'theMiskatonicMuseum', next: 'beforeTrain' },
      beforeTrain: { type: 'interlude', title: '前往敦威治', next: 'train' },
      train: { type: 'scenario', scenarioId: 'theEssexCountyExpress', next: 'beforeAltar' },
      beforeAltar: { type: 'interlude', title: '调查敦威治', next: 'altar' },
      altar: { type: 'scenario', scenarioId: 'bloodOnTheAltar', next: 'afterAltar' },
      afterAltar: route({ resolution: { scenarioId: 'bloodOnTheAltar', value: 'noResolution' } }, 'beforeBrood', 'survivors'),
      survivors: { type: 'story', title: '幕间二：幸存者', effects: [{ type: 'dunwichSurvivors' }], next: 'beforeBrood' },
      beforeBrood: { type: 'interlude', title: '追踪子嗣', next: 'brood' },
      brood: { type: 'scenario', scenarioId: 'undimensionedAndUnseen', next: 'beforeHill' },
      beforeHill: { type: 'interlude', title: '前往哨兵山', next: 'hill' },
      hill: { type: 'scenario', scenarioId: 'whereDoomAwaits', next: 'afterHill' },
      afterHill: route({ resolution: { scenarioId: 'whereDoomAwaits', value: 'r1' } }, 'beforeBeyond', 'epilogue'),
      beforeBeyond: { type: 'interlude', title: '穿过传送门', next: 'beyond' },
      beyond: { type: 'scenario', scenarioId: 'lostInTimeAndSpace', next: 'epilogue' },
      epilogue: { type: 'end' },
    },
  },
}
