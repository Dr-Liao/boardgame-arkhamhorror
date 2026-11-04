// 印斯茅斯暗潮（The Innsmouth Conspiracy）· 战役清单（P8 生产注册）。
//
// 与 P7 目录清单的差别只有发布口径：status 'playable'、8 章进生产组合根（content/registered.js），
// 并补上战役结局匹配表（manifest.endings）——src/campaign/campaign.js#campaignEnding 按顺序
// 取第一个命中的记录作为战役结果标签，没有 endings 时终局没有结局名。
// flow/unlock/recordSchema/interludeHandlerId/resolutionIds 保持 P7 已验证的结构不变。
import { RECORD_TYPES } from './records.js'
import { flow } from './flow.js'
import { CAMPAIGN_ID, CHAOS_BAGS, chapters, ENCOUNTER_GROUPS } from './shared.js'

// 结局匹配表：按最终章「暗潮之下」写下的记录取第一个命中的结局。
// 顺序即优先级（「深潜者淹没大地」是失败终局，优先于其它胜利/半胜分支）。
export const ENDINGS = Object.freeze([
  Object.freeze({ id: 'deepOnesFloodedEarth', label: '结局：深潜者淹没大地',
    record: 'TheDeepOnesHaveFloodedTheEarth' }),
  Object.freeze({ id: 'plotThwartedHarperComplete', label: '结局：阴谋被挫败，哈珀特工完成使命',
    record: 'AgentHarpersMissionIsComplete' }),
  Object.freeze({ id: 'plotThwartedRichesLost', label: '结局：阴谋被挫败，深海财富永失',
    record: 'TheRichesOfTheDeepAreLostForever' }),
  Object.freeze({ id: 'floodBegunHarperComplete', label: '结局：洪水开始，哈珀特工完成使命却代价惨重',
    record: 'AgentHarpersMissionIsCompleteButAtWhatCost' }),
  Object.freeze({ id: 'floodBegunRichesLost', label: '结局：洪水开始，深海财富永失且代价惨重',
    record: 'TheRichesOfTheDeepAreLostForeverButAtWhatCost' }),
])

export const manifest = Object.freeze({
  schemaVersion: 1, id: CAMPAIGN_ID, name: '印斯茅斯暗潮', nameEn: 'The Innsmouth Conspiracy',
  contentVersion: '1.0.0', minRulesVersion: 'n6.0', status: 'playable',
  requiredPackIds: ['core', 'ticCampaign', 'ticInvestigators', 'ticPlayer'],
  scenarioIds: chapters.map(chapter => chapter.id),
  sharedEncounterGroupIds: ENCOUNTER_GROUPS.filter(group => !chapters.some(chapter => chapter.encounterCode === group)),
  unlock: Object.fromEntries(chapters.map((chapter, index) => [chapter.id, index ? [chapters[index - 1].id] : []])),
  chaosBags: CHAOS_BAGS, recordSchema: RECORD_TYPES,
  flow,
  endings: ENDINGS,
  interludeHandlerId: 'innsmouthInterludes', resolutionIds: ['victory', 'defeat'],
})
