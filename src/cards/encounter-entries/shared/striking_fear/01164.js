// 01164 呆若木鸡
// 归属：跨战役通用
// 遭遇组：striking_fear
// 卡面：显现 - 将呆若木鸡放置入场，放到你的威胁区域。
// 卡面：你每轮第一次执行以下行动(移动、攻击、或躲避)之一，须支付额外1个行动。
// 卡面：强制 - 当你的回合结束时：检定[willpower](3)。如果你检定成功，弃掉呆若木鸡。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf } from '../../_shared.js'

export default {
  code: '01164', implemented: true, scope: 'treachery', treacheryRule: {"threatArea":true,"threat":{"extraActionCost":["move","fight","evade"],"endTurnTest":{"skill":"willpower","difficulty":3}}},
  encounterResolve(state, inv, card, api) {
    if ((inv.threat || []).some(item => originalOf(item) === '01164')) { api.drawEncounter(inv.seat); return false }
    api.threat(inv.seat, '01164')
    return true
  },
}
