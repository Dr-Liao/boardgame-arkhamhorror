// 03145 引入歧途
// 归属：关卡专用 · echoesOfThePast（卡尔克萨之路 · 往事回声）
// 遭遇组：echoes_of_the_past
// 卡面：险境。
// 卡面：显现 - 你必须决定(选择一项)：
// 卡面：- 将你的1个线索放置到一个[[异教徒]]敌人上。
// 卡面：- 在当前密谋上放置1个毁灭标记(本效果可以导致当前密谋推进)。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 误入歧途（03145）：把 1 个线索移到异教徒身上，或在当前议程放 1 个毁灭。

import { originalOf } from '../../_shared.js'

export default {
  code: '03145', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  encounterResolve(state, inv, card, api) {
    const code = originalOf(card)
    const cultists = (state.enemies || []).filter(enemy => enemy.traits?.includes('Cultist'))
    const options = [{ id: 'agenda', label: '在当前议程放置 1 个毁灭' }]
    if (inv.clues > 0) {
      options.unshift(...cultists.map(enemy => ({ id: enemy.id, label: `将 1 个线索移到${enemy.name}` })))
    }
    const answer = api.choose({ kind: 'encounter', source: code, seat: inv.seat, prompt: '误入歧途', options })
    const enemy = cultists.find(candidate => candidate.id === answer)
    if (enemy) {
      inv.clues--
      enemy.doom = (enemy.doom || 0) + 1
    } else state.doom++
    return false
  },
}
