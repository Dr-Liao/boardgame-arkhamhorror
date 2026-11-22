// 重返苍白面具 · 章节行为。
//
// 基础章节的地下墓穴牌库/网格探索/揭示/结局记录直接复用基础 behavior；这里只覆盖
// 52048 背面的布置差异：在基础地下墓穴牌库建好后，随机移出四张地点、混入四张新的
// 地下墓穴地点（52049–52052）。基础 behavior 的 `nextSlot`/`variantFor` 会按场景
// 定义表自动处理新卡号，因此不需要重写整段网格布置。
import { behavior as baseBehavior } from '../../../thePathToCarcosa/scenarios/thePallidMask/behavior.js'
import { RETURN_CATACOMB_CODES } from './definition.js'
import { returnToIntroduction } from '../../story.js'

function shuffleWith(state, items, helper) {
  if (helper?.shuffle && helper?.randomValue) return helper.shuffle([...items], () => helper.randomValue(state))
  return [...items]
}

export const behavior = {
  ...baseBehavior,
  id: 'returnToThePallidMask',
  introduction: returnToIntroduction('thePallidMask'),

  setupLocations(state, events, helper) {
    // 基础布置：抽取起始点、建牌库、放入起始地下墓穴并生成 03059。
    const placed = baseBehavior.setupLocations
      ? baseBehavior.setupLocations(state, events, helper)
      : [state.scenario.startLocation]
    const zones = state.scenarioZones ||= {}
    const deck = [...(zones.catacombsDeck || [])]
    // 52048 背面：随机选择四张地下墓穴地点从游戏中移除（不查看已揭示面）。
    const removed = []
    while (removed.length < 4 && deck.length) {
      const index = Math.floor((helper?.randomValue ? helper.randomValue(state) : Math.random()) * deck.length)
      removed.push(deck.splice(index, 1)[0])
    }
    zones.removed = [...(zones.removed || []), ...removed]
    // 四张新的地下墓穴地点加入剩余牌库并混洗。
    zones.catacombsDeck = shuffleWith(state, [...deck, ...RETURN_CATACOMB_CODES], helper)
    zones.returnCatacombsAdded = true
    return placed
  },
}
