// 03262 地下深坑
// 归属：关卡专用 · thePallidMask（卡尔克萨之路 · 苍白面具）
// 遭遇组：the_pallid_mask
// 卡面：显现 - 如果你所在地点没有附属地下深坑，附属到你所在地点(如果已有，改为弃掉地下深坑且其获得涌动)。
// 卡面：附属地点的隐藏值+1。
// 卡面：强制 - 当一轮结束时：位于附属地点的每位调查员受到3点伤害。弃掉地下深坑。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf } from '../../_shared.js'

export default {
  code: '03262', scope: 'treachery', implemented: true, encounterResolveCampaigns: ['carcosa'],
  encounterResolve(state, inv, card, api, { location }) {
    location.attachments ||= []
    if (location.attachments.some(attachment =>
      originalOf(typeof attachment === 'string' ? { code: attachment } : attachment) === '03262')) {
      api.drawEncounter(inv.seat)
      return false
    }
    location.attachments.push({ id: `pit:${state.round}:${state.moveCount}`, code: '03262', originalCode: '03262' })
    location.shroudMod = (location.shroudMod || 0) + 1
    return true
  },
}
