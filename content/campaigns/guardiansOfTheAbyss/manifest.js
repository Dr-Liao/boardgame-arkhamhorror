// 批次 4 · Beta 支线《深渊守卫》（Guardians of the Abyss · 83001）· 双章战役清单。
//
// 参考：
//   Campaign/Campaigns/GuardiansOfTheAbyss.hs（PrologueStep → ScenarioStep "83001" → ScenarioStep "83016"）
//   Scenario/Scenarios/GuardiansOfTheAbyss/{TheEternalSlumber,TheNightsUsurper}.hs（Setup / 结局 / 袋）
//   frontend/src/arkham/data/side-stories.json（83001: xp 2 / Standard,Hard / beta / 两章配置）
//   frontend/src/locales/en/standalone/{guardiansOfTheAbyss,theEternalSlumber,theNightsUsurper}.json
//
// opening.experience = side-stories.json 的 xp 2（独立支线插入费用同额，批次 2 口径）。
// 两章按固定顺序推进：theEternalSlumber → theNightsUsurper → end；跨章记录（dreamersInTheAbyss /
// brotherhoodAgentsWhoEscaped / wasTakenByTheAbyss）由 campaign.records 携带。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { CHAOS_BAGS, RECORD_LABELS, RECORD_TYPES } from './shared.js'

export const SCENARIO_ORDER = Object.freeze(['theEternalSlumber', 'theNightsUsurper'])
export const OPENING_EXPERIENCE = 2
export { CHAOS_BAGS, RECORD_LABELS, RECORD_TYPES }

export const manifest = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'guardiansOfTheAbyss',
  sideStory: true,
  name: '深渊守卫',
  nameEn: 'Guardians of the Abyss',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  requiredPackIds: ['core', 'guardiansCampaign'],
  opening: Object.freeze({ experience: OPENING_EXPERIENCE }),
  scenarioIds: SCENARIO_ORDER,
  unlock: Object.freeze({
    theEternalSlumber: Object.freeze([]),
    theNightsUsurper: Object.freeze(['theEternalSlumber']),
  }),
  chaosBags: CHAOS_BAGS,
  recordSchema: RECORD_TYPES,
  recordLabels: RECORD_LABELS,
  interludeHandlerId: 'coreInterlude',
  resolutionIds: Object.freeze(['noResolution', 'resolution1', 'resolution2', 'resolution3']),
  flow: Object.freeze({
    start: 'theEternalSlumber',
    nodes: Object.freeze({
      theEternalSlumber: Object.freeze({ type: 'scenario', scenarioId: 'theEternalSlumber', next: 'slumberReward' }),
      // 第一章结局奖励（参考 R1/R2：约翰和杰西·伯克 / 古老圣甲虫护符）。作为关间决策节点，
      // 奖励入牌组走战役效果 addCampaignCardToDeck（不计牌组张数）。
      slumberReward: Object.freeze({
        type: 'choice',
        prompt: '第一章结算：是否让一位调查员获得剧情资产？',
        options: Object.freeze([
          Object.freeze({
            id: 'addJohnAndJessie', label: '将「约翰和杰西·伯克」加入一位调查员的牌组（结局 1）',
            when: Object.freeze({ resolution: Object.freeze({ scenarioId: 'theEternalSlumber', value: 'resolution1' }) }),
            effects: Object.freeze([Object.freeze({
              type: 'addCampaignCardToDeck', code: '83055', seats: Object.freeze([0]), reason: '长眠诅咒被解除',
            })]),
            next: 'theNightsUsurper',
          }),
          Object.freeze({
            id: 'addAncientAnkh', label: '将「古老圣甲虫护符」加入一位调查员的牌组（结局 2）',
            when: Object.freeze({ resolution: Object.freeze({ scenarioId: 'theEternalSlumber', value: 'resolution2' }) }),
            effects: Object.freeze([Object.freeze({
              type: 'addCampaignCardToDeck', code: '83056', seats: Object.freeze([0]), reason: '知晓伊扎法拉的阴谋',
            })]),
            next: 'theNightsUsurper',
          }),
          Object.freeze({ id: 'continue', label: '不领取剧情资产，进入《夜之篡位者》', next: 'theNightsUsurper' }),
        ]),
      }),
      theNightsUsurper: Object.freeze({ type: 'scenario', scenarioId: 'theNightsUsurper', next: 'usurperReward' }),
      // 第二章结局奖励（参考 R2/R3：召唤夜魇 / 深渊弯刀）。
      usurperReward: Object.freeze({
        type: 'choice',
        prompt: '第二章结算：是否让一位调查员获得剧情资产？',
        options: Object.freeze([
          Object.freeze({
            id: 'addSummonedNightgaunt', label: '将「召唤夜魇」加入一位调查员的牌组（结局 2）',
            when: Object.freeze({ resolution: Object.freeze({ scenarioId: 'theNightsUsurper', value: 'resolution2' }) }),
            effects: Object.freeze([Object.freeze({
              type: 'addCampaignCardToDeck', code: '83058', seats: Object.freeze([0]), reason: '深渊已被拯救',
            })]),
            next: 'end',
          }),
          Object.freeze({
            id: 'addKhopesh', label: '将「深渊弯刀」加入一位调查员的牌组（结局 3）',
            when: Object.freeze({ resolution: Object.freeze({ scenarioId: 'theNightsUsurper', value: 'resolution3' }) }),
            effects: Object.freeze([Object.freeze({
              type: 'addCampaignCardToDeck', code: '83057', seats: Object.freeze([0]), reason: '与伊扎法拉联手',
            })]),
            next: 'end',
          }),
          Object.freeze({ id: 'continue', label: '不领取剧情资产，结束支线', next: 'end' }),
        ]),
      }),
      end: Object.freeze({ type: 'end' }),
    }),
  }),
})

// Compatibility shape for the existing campaign engine and snapshots.
export const CAMPAIGN = Object.freeze({
  id: manifest.id, name: manifest.name, nameEn: manifest.nameEn, scenarioOrder: manifest.scenarioIds,
})

export default manifest
