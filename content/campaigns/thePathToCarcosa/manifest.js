import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { CHAOS_BAGS, chapters, recordTypes } from './shared.js'
import { storyText } from './story-text.js'
import { CARCOSA_RECORD_LABELS } from './records.js'
import { RESEARCH_RECORD_LABELS, RESEARCH_RECORD_TYPES } from '../research-records.js'

const record = (key, value = true) => ({ type: 'record', key, value })
const increment = (key, amount) => ({ type: 'increment', key, amount })
const resolution = (scenarioId, value) => ({ resolution: { scenarioId, value } })
const route = (condition, yes, no) => ({ type: 'branch', options: [
  { id: 'yes', when: condition, next: yes },
  { id: 'no', when: { not: condition }, next: no },
] })

// The original eight-chapter route is available in the hall.
// End-to-end M5 browser/online certification remains tracked separately.
export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'thePathToCarcosa',
  name: '卡尔克萨之路',
  nameEn: 'The Path to Carcosa',
  contentVersion: '0.2.0',
  minRulesVersion: 'n4.2',
  status: 'playable',
  requiredPackIds: ['core', 'carcosaCampaign'],
  scenarioIds: chapters.map(chapter => chapter.id),
  unlock: Object.fromEntries(chapters.map((chapter, index) =>
    [chapter.id, index ? [chapters[index - 1].id] : []])),
  chaosBags: CHAOS_BAGS,
  recordLabels: { ...RESEARCH_RECORD_LABELS, ...CARCOSA_RECORD_LABELS },
  recordSchema: { ...recordTypes, ...RESEARCH_RECORD_TYPES },
  interludeHandlerId: 'carcosaInterlude',
  resolutionIds: ['victory', 'defeat'],
  // 第 124 轮：关末把「苍白面具」这张战役弱点转交给携带者。
  // 原先引擎里写的是 `campaign.id === 'thePathToCarcosa'`，现在由战役清单声明记录键。
  campaignWeaknessTransferRecord: 'pallidMaskBearer',
  flow: {
    start: 'prologue',
    nodes: {
      // Full prologue is folded into Curtain Call so it is recorded exactly once.
      prologue: { type: 'story', next: 'curtainCall' },
      curtainCall: { type: 'scenario', scenarioId: 'curtainCall', next: 'beforeLastKing' },
      beforeLastKing: { type: 'interlude', title: '准备参加晚宴', next: 'theLastKing' },
      theLastKing: { type: 'scenario', scenarioId: 'theLastKing', next: 'afterLastKing' },
      afterLastKing: route(resolution('theLastKing', 'r1'), 'interludeOne', 'beforeEchoes'),
      interludeOne: {
        type: 'choice',
        ...storyText.interludeOne,
        prompt: '你们如何处理晚宴中发生的一切？',
        options: [
          {
            id: 'intrude',
            label: '闯入秘密集会',
            effects: [
              record('youIntrudedOnASecretMeeting'),
              increment('doubt', 1),
              { type: 'replaceChaosFamily', tokens: ['elderthing', 'elderthing'] },
            ],
            next: 'beforeEchoes',
          },
          {
            id: 'flee',
            label: '逃离晚宴',
            effects: [
              record('youFledTheDinnerParty'),
              { type: 'replaceChaosFamily', tokens: ['tablet', 'tablet'] },
            ],
            next: 'beforeEchoes',
          },
          {
            id: 'burn',
            label: '烧毁庄园，消灭怪物',
            effects: [
              record('youSlayedTheMonstersAtTheDinnerParty'),
              increment('conviction', 1),
              { type: 'recordUnion', key: 'vipsSlain', values: ['03065', '03066', '03067', '03068', '03069'] },
              { type: 'replaceChaosFamily', tokens: ['cultist', 'cultist'] },
            ],
            next: 'beforeEchoes',
          },
        ],
      },
      beforeEchoes: { type: 'interlude', title: '前往历史协会', next: 'echoesOfThePast' },
      echoesOfThePast: { type: 'scenario', scenarioId: 'echoesOfThePast', next: 'beforeOath' },
      beforeOath: { type: 'interlude', title: '前往阿卡姆疯人院', next: 'theUnspeakableOath' },
      theUnspeakableOath: { type: 'scenario', scenarioId: 'theUnspeakableOath', next: 'afterOath' },
      afterOath: route({
        any: ['r2', 'r3'].map(value => resolution('theUnspeakableOath', value)),
      }, 'danielBonus', 'beforePhantom'),
      danielBonus: route({ record: 'danielStatus', equals: 'survived' }, 'danielSurvived', 'interludeTwo'),
      danielSurvived: {
        type: 'story',
        title: '丹尼尔幸存',
        text: '丹尼尔活着离开了疯人院。每位调查员获得 2 点经验。',
        effects: [{ type: 'experience', amount: 2 }],
        next: 'interludeTwo',
      },
      interludeTwo: {
        type: 'choice',
        ...storyText.interludeTwo,
        prompt: '你们是否听从丹尼尔的警告？',
        options: [
          {
            id: 'ignore',
            label: '忽略警告',
            effects: [record('youIgnoredDanielsWarning'), increment('doubt', 2)],
            next: 'beforePhantom',
          },
          {
            id: 'heed',
            label: '听从警告',
            effects: [
              record('youHeadedDanielsWarning'),
              increment('conviction', 2),
              { type: 'experience', amount: 1 },
              { type: 'campaignRuleFlag', key: 'hasturNameHorror', value: true },
            ],
            next: 'beforePhantom',
          },
        ],
      },
      beforePhantom: { type: 'interlude', title: '前往巴黎', next: 'aPhantomOfTruth' },
      aPhantomOfTruth: { type: 'scenario', scenarioId: 'aPhantomOfTruth', next: 'beforePallidMask' },
      beforePallidMask: { type: 'interlude', title: '追入地下墓穴', next: 'thePallidMask' },
      thePallidMask: { type: 'scenario', scenarioId: 'thePallidMask', next: 'beforeBlackStars' },
      beforeBlackStars: { type: 'interlude', title: '前往圣米歇尔山', next: 'blackStarsRise' },
      blackStarsRise: { type: 'scenario', scenarioId: 'blackStarsRise', next: 'beforeDimCarcosa' },
      beforeDimCarcosa: { type: 'interlude', title: '穿过开启的道路', next: 'dimCarcosa' },
      dimCarcosa: { type: 'scenario', scenarioId: 'dimCarcosa', next: 'afterDimCarcosa' },
      afterDimCarcosa: {
        type: 'branch',
        options: [
          {
            id: 'success',
            when: { any: ['r1', 'r2', 'r3'].map(value => resolution('dimCarcosa', value)) },
            next: 'possessedEpilogue',
          },
          {
            id: 'failure',
            when: { not: { any: ['r1', 'r2', 'r3'].map(value => resolution('dimCarcosa', value)) } },
            next: 'end',
          },
        ],
      },
      possessedEpilogue: {
        type: 'story',
        effects: [{
          type: 'privateStory',
          id: 'carcosaPossessedEpilogue',
          title: storyText.possessedEpilogue.title,
          text: storyText.possessedEpilogue.text,
          audienceRecord: 'possessed',
        }],
        next: 'end',
      },
      end: { type: 'end' },
    },
  },
}
