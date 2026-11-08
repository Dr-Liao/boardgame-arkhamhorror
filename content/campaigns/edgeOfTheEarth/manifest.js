// 七循环《地球边缘》战役清单（P7：生产注册 + 可启动）。
//
// status playable：8 个章节单元（8 份章节测试 + 共享遭遇 + 战役流 + 指南/浏览器验收）通过后开放；
// flow/recordSchema/recordDefaults/recordLabels 来自 P7 战役流程层（content/campaigns/edgeOfTheEarth/flow.js），
// 章节顺序/混乱袋/遭遇组沿用 shared.js 的 P0 事实。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { CAMPAIGN_ID, CHAOS_BAGS, chapters, ENCOUNTER_GROUPS, SHARED_ENCOUNTER_GROUPS } from './shared.js'
import { campaignFlowExtras } from './flow.js'
import { EOTE_STORY_META } from './story-text.js'
import { EXPEDITION_TEAM_CODES, MEMORIAL_CODES } from './shared-encounters.js'

// 战役共用、但不带 encounterCode 的剧情资产（伙伴支援/纪念逝者）：归属算法按本表落到
// edgeOfTheEarth/_shared/<组>/，避免这些卡因为没有章节 token 被判 unresolved。
const SHARED_STORY_ASSET_GROUPS = Object.freeze(Object.fromEntries([
  ...EXPEDITION_TEAM_CODES.map(code => [code, 'expedition_team']),
  ...MEMORIAL_CODES.map(code => [code, 'memorials_of_the_lost']),
]))

export const manifest = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: CAMPAIGN_ID,
  name: '地球边缘',
  nameEn: 'Edge of the Earth',
  contentVersion: '1.0.0',
  minRulesVersion: 'n6.0',
  status: 'playable',
  requiredPackIds: ['core', 'eoteCampaign', 'eoteInvestigators', 'eotePlayer'],
  scenarioIds: chapters.map(chapter => chapter.id),
  sharedEncounterGroupIds: SHARED_ENCOUNTER_GROUPS,
  sharedStoryAssetGroups: SHARED_STORY_ASSET_GROUPS,
  encounterGroupIds: ENCOUNTER_GROUPS,
  // 目录期顺序作为 unlock 的保守前驱；真实分支由 flow 节点（检查点/幕间/致命幻景）表达。
  unlock: Object.fromEntries(chapters.map((chapter, index) =>
    [chapter.id, index ? [chapters[index - 1].id] : []])),
  chaosBags: CHAOS_BAGS,
  interludeHandlerId: 'edgeOfTheEarthInterludes',
  resolutionIds: ['victory', 'defeat'],
  story: Object.freeze({ status: EOTE_STORY_META.status, sourceKind: EOTE_STORY_META.sourceKind,
    officialChinese: EOTE_STORY_META.officialChinese === true }),
  ...campaignFlowExtras,
})
