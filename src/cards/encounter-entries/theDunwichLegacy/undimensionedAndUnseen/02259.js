// 02259 怪物的踪迹
// 归属：关卡专用 · undimensionedAndUnseen（无人知晓）
// 遭遇组：undimensioned_and_unseen
// 卡面：险境
// 卡面：显现 - 你必须 (选择以下一项)：受到2点恐惧，或在一个随机地点生成一个放在一边的犹格·索托斯之子。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { chooseBroodRandomLocation } from '../../_shared.js'

export default {
  code: '02259', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['dunwich'],
  encounterResolve(state, inv, card, api) {
    const code = card.originalCode || card.code
    const options = [{ id: 'horror', label: '受到 2 点恐惧' }]
    if (state.scenarioZones.brood.remaining > 0) options.push({ id: 'spawn', label: '在随机地点生成一只备用子嗣' })
    const choice = api.choose({ kind: 'encounter', source: code, seat: inv.seat,
      prompt: '生物的踪迹：受到 2 点恐惧，或生成一只备用子嗣。', options })
    if (choice === 'horror') api.horror(inv.seat, 2)
    else {
      const location = chooseBroodRandomLocation(state, api)
      state.scenarioZones.brood.remaining--
      state.scenarioZones.setAside.splice(state.scenarioZones.setAside.indexOf('02255'), 1)
      const enemy = api.spawn('02255', location.id)
      if (enemy) enemy.health = 1 + state.numInvestigators
    }
    return false
  },
}
