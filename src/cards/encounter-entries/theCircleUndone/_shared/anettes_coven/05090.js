// 05090 女巫集会学徒
// 归属：战役共用 · theCircleUndone；遭遇组：anettes_coven
// 卡面：显现 - 弃掉遭遇牌库顶 2 张卡牌。如果本效果导致遭遇牌库的卡牌耗尽，
//   抽取遭遇弃牌堆最顶部的[[巫术]]卡牌（英文 trait = Hex）。
//
// 引擎没有「敌人显现」的通用窗口：抽到敌人时引擎先 spawnEnemy，再派发 behavior.enemySpawned，
// 因此显现效果写在 enemyScript.onSpawn 里。近似：被剧本效果生成的学徒同样会结算显现
// （已记入 status.json 的 gaps/approximations）。

import { ALL_CARDS } from '../../../_shared.js'

export default {
  code: '05090',
  scope: 'enemy',
  implemented: true,
  enemyScript: {
    onSpawn(state, enemy, api) {
      const deck = state.encounterDeck
      const discarded = []
      for (let index = 0; index < 2; index++) {
        if (!deck.length) break
        const code = deck.pop()
        state.encounterDiscard.push(code)
        discarded.push(code)
      }
      const labels = discarded.map(code => ALL_CARDS[code]?.nameZh || code).join('、') || '无'
      api.info?.(`女巫集会学徒：弃掉遭遇牌库顶 2 张卡牌（${labels}）。`)
      if (state.encounterDeck.length > 0) return
      // 遭遇牌库耗尽：取遭遇弃牌堆最顶部的巫术（Hex）卡牌并抽取（重新放回牌库顶再走抽牌管线）。
      const discard = state.encounterDiscard
      for (let index = discard.length - 1; index >= 0; index--) {
        const code = discard[index]
        const card = ALL_CARDS[code]
        if (!card || !(card.traits || []).some(trait => String(trait).toLowerCase() === 'hex')) continue
        discard.splice(index, 1)
        state.encounterDeck.push(code)
        const seat = enemy.drawnBySeat != null ? enemy.drawnBySeat : (state.campaign?.leadSeat ?? 0)
        api.info?.(`遭遇牌库耗尽：抽取遭遇弃牌堆顶的巫术卡牌「${card.nameZh || card.name}」。`)
        api.drawEncounter?.(seat)
        return
      }
      api.info?.('遭遇弃牌堆里没有巫术卡牌。')
    },
  },
}

