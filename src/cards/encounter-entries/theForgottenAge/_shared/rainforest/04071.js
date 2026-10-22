// 04071 索桥
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：rainforest
// 卡面：强制 - 在你位于索桥并尝试探索时：检定[agility](2)。如果你检定失败，取消本次探索，受到2点伤害，失去所有剩余行动并结束你的回合。将你的调查员放在河流峡谷(如果该地点不在场上，先查找探索牌库，找出河流峡谷并将它放置入场；混洗探索牌库)。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 索桥（04071）：探索前敏捷（2）检定；失败取消探索、受到 2 点伤害、失去行动并结束回合，
// 并把调查员放到河流峡谷（不在地图上时先从探索牌库找出来放场）。

import { originalOf } from '../../../_shared.js'

export default {
  code: '04071', scope: 'location',
  locationRule: {
    beforeExplore(state, inv, api) {
      let failed = false
      api.test(inv.seat, 'agility', 2, result => {
        if (result.success) return
        failed = true
        api.damage(inv.seat, 2)
        api.loseActions(inv.seat, 99)
        api.endTurn(inv.seat)
      })
      if (!failed) return true
      const canyon = state.locations.find(entry => originalOf(entry) === '04070')
      if (canyon) api.moveInvestigator(inv.seat, canyon.id)
      else {
        const index = (state.explorationDeck || []).findIndex(entry => entry === 'riverCanyon')
        if (index >= 0) {
          state.explorationDeck.splice(index, 1)
          api.place('riverCanyon')
          api.shuffleExploration?.()
          api.moveInvestigator(inv.seat, 'riverCanyon')
        }
      }
      return false
    },
  },
}
