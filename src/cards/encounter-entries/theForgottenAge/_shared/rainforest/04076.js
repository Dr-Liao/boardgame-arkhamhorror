// 04076 疯狂生长
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：rainforest
// 卡面：显现 - 附属到你所在地点。每个地点仅限1张。
// 卡面：你不能在本卡牌附属的地点探索。
// 卡面：[action]：检定[combat](4)来从灌木丛中辟出道路，或检定[intellect](4)来另寻出路。如果你检定成功，弃掉疯狂生长。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf } from '../../../_shared.js'

export default {
  code: '04076', scope: 'treachery', implemented: true,
  threatAction: { rule: 'clearOvergrowth', label: '清除疯狂生长', skills: ['combat', 'intellect'], difficulty: 4, target: 'location', skillLabels: { combat: '检定战斗(4)清除疯狂生长', intellect: '检定智识(4)清除疯狂生长' } },
  encounterResolve(state, inv, card, api, { location }) {
    if (!location) return false
    if ((location.attachments || []).some(item => originalOf(item) === '04076')) {
      api.drawEncounter(inv.seat)
      return false
    }
    location.attachments ||= []
    location.attachments.push({ id: `overgrowth:${state.round}:${location.id}`, code: '04076', originalCode: '04076' })
    api.info?.('疯狂生长附属到此地点：此处不能探索。')
    return true
  },
}
