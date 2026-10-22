// 01165 刺耳之声
// 归属：跨战役通用
// 遭遇组：striking_fear
// 卡面：显现 - 将刺耳之声放置入场，放到你的威胁区域。
// 卡面：你不能打出支援或事件。
// 卡面：强制 - 当一轮结束时：弃掉刺耳之声。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf } from '../../_shared.js'

export default {
  code: '01165', implemented: true, scope: 'treachery', treacheryRule: {"threatArea":true,"threat":{"cannotPlay":["asset","event"],"roundEndDiscard":true}},
  encounterResolve(state, inv, card, api) {
    if ((inv.threat || []).some(item => originalOf(item) === '01165')) { api.drawEncounter(inv.seat); return false }
    api.threat(inv.seat, '01165')
    return true
  },
}
