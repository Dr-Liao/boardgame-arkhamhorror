// 04144 密不可泄
// 归属：关卡专用 · threadsOfFate（失落的时代 · 命运之线）
// 遭遇组：threads_of_fate
// 卡面：险境。
// 卡面：显现 - 检定[willpower](3)。如果你检定失败，受到1点伤害和1点恐惧。调查员每完成一个场景牌库，本次技能检定难度+1，且检定失败造成的伤害和恐惧各+1。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 瓦卢西亚的预示者（04062）的入场脚本在上面的敌人清单里（harbingerSpawn 顺带记 harbingerEnteredPlay）。
// 哈伦·恩斯通（04122b）/ 亚历山卓·维拉（04130b）/ 伊塔卡（04137b）的生成脚本在上面的敌人清单里扩展。
// 命运之线的三张遭遇卡（只在失落时代出现，用战役限定入口）。

import { threadActDecksInPlay } from '../../_shared.js'

export default {
  code: '04144', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['tfa'],
  encounterResolve(state, inv, card, api) {
    const decks = threadActDecksInPlay(state)
    const bonus = Math.max(0, 3 - decks)
    api.test(inv.seat, 'willpower', 3 + bonus, result => {
      if (result.success) return
      for (let index = 0; index < 1 + bonus; index++) {
        api.damage(inv.seat, 1)
        api.horror(inv.seat, 1)
      }
    }, 0, null, { peril: true })
    return false
  },
}
