import { buildChapter } from '../../chapters.js'
import { laterBehavior } from '../../later-behaviors.js'
const chapter = buildChapter('lostInTimeAndSpace')
// 02316–02319 的 [action]（弃遭遇牌库顶 3 张并结算一个地点的显现）印在当前幕卡上。
export const scenario = { ...chapter.scenario, scriptCards: {
  rules: { searchEncounterLocations: { card: 'act', codes: ['02316', '02317', '02318', '02319'] } },
} }
export const { identities, layout, manifest } = chapter
export const behavior = laterBehavior('lostInTimeAndSpace')
