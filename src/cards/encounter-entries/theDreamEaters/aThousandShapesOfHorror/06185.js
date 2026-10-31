// 06185 地点「神秘阶梯」（Mysterious Stairs · [[墓地]]）· 万千骇形（185）
// 归属：关卡专用 · aThousandShapesOfHorror。卡面：神秘阶梯与其上方和下方的地点连接。
// 本地点上有重整状态的敌人时，位于本地点的调查员不能移动，也不能撤退。
// 强制 - 在本地点揭示时：查找遭遇牌库和遭遇弃牌堆，找出一张[[食尸鬼]]敌人并将其生成在本地点。
// 混洗遭遇牌库。
//
// 依据 Haskell Location/Cards/.../MysteriousStairs_185.hs（findEncounterCard Ghoul + createEnemyAt）：
//   · 查找/取出遭遇卡走 api.discardEncounterCard（牌库→弃牌堆）与 api.takeEncounterDiscard（弃牌堆取出），
//     不直写 state.encounterDeck / state.encounterDiscard（R1 口径）；
//   · 生成走 api.spawn；混洗走 api.shuffleEncounterDeck；
//   · 线索锁数据 blockWhileReadyEnemy，behavior.moveError / actionBlocked 读。
import { ALL_CARDS } from '../../_shared.js'

const MYSTERIOUS_STAIRS = '06185'

const isGhoulEnemy = code => {
  const card = ALL_CARDS[code]
  return card?.type === 'enemy'
    && (card.traits || []).some(trait => String(trait).toLowerCase() === 'ghoul')
}

// 遭遇牌库顶先找（牌库读取只读 state）；弃牌堆兜底。
const findGhoulInEncounterPiles = state => {
  const deck = [...(state.encounterDeck || [])].reverse()
  const inDeck = deck.find(isGhoulEnemy)
  if (inDeck) return { code: inDeck, fromDeck: true }
  const discard = [...(state.encounterDiscard || [])].reverse()
  const inDiscard = discard.find(isGhoulEnemy)
  return inDiscard ? { code: inDiscard, fromDeck: false } : null
}

export default {
  code: MYSTERIOUS_STAIRS,
  scope: 'location',
  implemented: true,
  locationRule: {
    blockWhileReadyEnemy: {
      move: true,
      resign: true,
      message: '「神秘阶梯」上有重整状态的敌人：位于本地点的调查员不能移动或撤退。',
    },
    onReveal(state, location, api) {
      const found = findGhoulInEncounterPiles(state)
      if (!found) {
        api.info?.('🪜 神秘阶梯：遭遇牌库与弃牌堆里没有[[食尸鬼]]敌人。')
        return true
      }
      if (found.fromDeck) api.discardEncounterCard?.(found.code)
      api.takeEncounterDiscard?.(found.code)
      const enemy = api.spawn?.(found.code, location.id)
      api.shuffleEncounterDeck?.()
      api.info?.(enemy
        ? `🪜 神秘阶梯：从遭遇牌库找出「${ALL_CARDS[found.code]?.nameZh || found.code}」并生成在本地点。`
        : '🪜 神秘阶梯：[[食尸鬼]]敌人生成失败。')
      return true
    },
  },
}
