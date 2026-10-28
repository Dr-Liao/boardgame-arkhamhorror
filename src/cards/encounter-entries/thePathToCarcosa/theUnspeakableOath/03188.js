// 03188 危墙迫近
// 归属：关卡专用 · theUnspeakableOath（卡尔克萨之路 · 邪秽誓约）
// 遭遇组：the_unspeakable_oath
// 卡面：显现 - 检定[willpower](X)，其中X为你所在地点的隐藏值。如果你检定失败，你必须从放在一边的[[怪物]]敌人中随机选择1个敌人，并将其放在场景牌库底下，不要查看内容，或每低于难度1点就受到1点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 危墙迫近（03188）：意志检定失败后，把随机怪物塞到场景牌库底下，或每差 1 点受到 1 点恐惧。

import { failedBy, originalOf, stashMonsterFromZones } from '../../_shared.js'

export default {
  code: '03188', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  name: '危墙迫近',
  text: '显现 - 检定意志(X)，X 为你所在地点的隐藏值。失败时把随机怪物放到场景牌库底下，或每低于难度 1 点受到 1 点恐惧。',
  encounterResolve(state, inv, card, api) {
    const code = originalOf(card)
    const location = state.locations.find(candidate => candidate.id === inv.location)
    api.test(inv.seat, 'willpower', location?.shroud || 0, result => {
      if (result.success) return
      const amount = failedBy(result, location?.shroud || 0)
      const options = [{ id: 'horror', label: `受到 ${amount} 点恐惧` }]
      if ((state.scenarioZones?.monsters || []).length) {
        options.push({ id: 'monster', label: '将随机怪物放到场景牌库底下' })
      }
      const answer = api.choose({ kind: 'encounter', source: code, seat: inv.seat, prompt: '墙壁逼近', options })
      if (answer === 'monster') stashMonsterFromZones(state, api)
      else api.horror(inv.seat, amount)
    })
    return false
  },
}
