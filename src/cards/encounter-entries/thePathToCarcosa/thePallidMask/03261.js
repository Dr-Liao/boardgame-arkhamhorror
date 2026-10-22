// 03261 身后暗影
// 归属：关卡专用 · thePallidMask（卡尔克萨之路 · 苍白面具）
// 遭遇组：the_pallid_mask
// 卡面：显现 - 将身后暗影放置入场，放到你的威胁区域。每位调查员仅限1张。
// 卡面：[action]：查看你身后。
// 卡面：强制 - 当你的回合结束时，如果你没有执行过上述[action]能力：你必须弃掉你所有资源或弃掉你所有手牌。然后，弃掉身后暗影。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf } from '../../_shared.js'

export default {
  code: '03261', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  treacheryRule: {
    encounterAction(state, inv, owner, threat) {
      return {
        action: 'encounterAction', rule: 'lookBehindYou', threatId: threat.id,
        threatOwnerSeat: owner.seat, actions: 1,
        label: `查看${owner.seat === inv.seat ? '' : owner.name + '的'}「身后暗影」背后`,
      }
    },
  },
  encounterResolve(state, inv, card, api) {
    if ((inv.threat || []).some(threat => originalOf(threat) === '03261')) return false
    api.threat(inv.seat, '03261')
    return true
  },
}
