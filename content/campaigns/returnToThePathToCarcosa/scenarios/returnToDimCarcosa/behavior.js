// 重返卡城幽影 · 章节行为。
//
// 基础章节的哈斯塔三版本、幕/密谋、背刺与结局记录直接复用基础 behavior；这里覆盖：
//   1. 布置：原版王之宫殿（03331）移出游戏，52061–52063 与四张剧情背面放在一边；
//   2. 52060b「哈斯塔的末路」：王之宫殿翻面时，按在场的哈斯塔版本从放在一边置入
//      你的内心深处 / 王座之间 / 沃德剧院舞台（王座之间版本还要把哈斯塔移过去）；
//   3. 52059 背面追加规则：没有调查员「知道了秘密」时，哈斯塔的生命值不能低于
//      每位调查员 2 点。
import { behavior as baseBehavior } from '../../../thePathToCarcosa/scenarios/dimCarcosa/behavior.js'
import { entryFlags } from '../../../../../src/cards/card-rules.js'
import { lowSanitySwapModifier } from '../../campaign-rules.js'
import {
  HASTUR_STORY_LOCATION, PALACE_OF_THE_KING, REMOVED_PALACE, RETURN_LOCATIONS,
  RETURN_STORY_CODES,
} from './definition.js'
import { returnToIntroduction } from '../../story.js'

const original = card => card?.originalCode || card?.code
const isHastur = card => entryFlags(original(card))?.hastur === true
const hasturInPlay = state => state.enemies.find(enemy => isHastur(enemy)) || null

export const behavior = {
  ...baseBehavior,
  id: 'returnToDimCarcosa',
  introduction: returnToIntroduction('dimCarcosa'),

  setupLocations(state, events, api) {
    const placed = baseBehavior.setupLocations(state, events, api)
    const zones = state.scenarioZones ||= {}
    zones.setAside = [...(zones.setAside || []), ...Object.values(RETURN_LOCATIONS), ...RETURN_STORY_CODES]
    zones.removed = [...(zones.removed || []), REMOVED_PALACE]
    state.scenarioFlags.palaceStoryRevealed = false
    state.scenarioFlags.hasturLifeFloor = 2
    return placed
  },

  // 52060b「哈斯塔的末路」：王之宫殿翻面时按当前哈斯塔版本置入对应地点。
  locationStory(state, location, api, seat) {
    baseBehavior.locationStory?.(state, location, api, seat)
    if (original(location) !== PALACE_OF_THE_KING) return
    const hastur = hasturInPlay(state)
    const targetId = HASTUR_STORY_LOCATION[original(hastur)] || 'recessesOfYourOwnMind'
    const aside = state.scenarioZones.setAside || []
    const index = aside.indexOf(RETURN_LOCATIONS[targetId])
    if (index >= 0) aside.splice(index, 1)
    state.scenarioFlags.palaceStoryRevealed = true
    api.info?.(`哈斯塔的末路：翻面后置入「${targetId}」。`)
    api.place?.(targetId)
    if (targetId === 'theThroneRoom' && hastur) {
      hastur.location = 'theThroneRoom'
      hastur.engagedSeat = null
      api.info?.('哈斯塔被移动到「王座之间」。')
    }
  },

  // 52069 猎食的拜亚基：与剩余神智 4 或以下的调查员交战时交换攻击/躲避值。
  enemyStatModifier(state, enemy, stat, inv) {
    const base = baseBehavior.enemyStatModifier?.(state, enemy, stat, inv) || 0
    return base + lowSanitySwapModifier(state, enemy, stat, inv)
  },

  // 52059 背面追加规则：没有调查员「知道了秘密」时，哈斯塔的生命值不能低于
  // 每位调查员 2 点。伤害量在放置前钳制（不改变印刷生命值）。
  enemyDamageAmount(state, enemy, total, api, seat, source) {
    let adjusted = baseBehavior.enemyDamageAmount?.(state, enemy, total, api, seat, source)
    if (!Number.isFinite(adjusted)) adjusted = total
    if (!isHastur(enemy)) return adjusted
    if (state.campaign?.records?.knowTheSecret) return adjusted
    const floor = 2 * Number(state.numInvestigators || 1)
    const currentHealth = Number(enemy.health || 0) - Number(enemy.damageTaken || 0)
    if (!Number.isFinite(currentHealth) || currentHealth <= floor) return 0
    return Math.max(0, Math.min(adjusted, currentHealth - floor))
  },
}
