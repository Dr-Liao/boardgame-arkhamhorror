// 03259 尸体寄居者
// 归属：关卡专用 · thePallidMask（卡尔克萨之路 · 苍白面具）
// 遭遇组：the_pallid_mask
// 卡面：生成 -  弃掉任意地点的一个[[类人]]敌人并在该地点生成尸体寄居者(如果场上没有[[类人]]敌人，改为弃掉尸体寄居者且其获得涌动)。
// 卡面：猎手。反击。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { ALL_CARDS, originalOf, chooseEntryOption } from '../../_shared.js'

export default {
  code: '03259', scope: 'enemy', implemented: true,
  enemyScript: {
    onSpawnLocation(state, code, fallback, seat, api) {
      const humanoids = state.enemies.filter(enemy => (ALL_CARDS[originalOf(enemy)]?.traits || enemy.traits || [])
        .map(trait => String(trait).toLowerCase()).includes('humanoid'))
      const target = chooseEntryOption(api, {
        kind: 'enemy', source: code, seat: seat ?? state.campaign.leadSeat,
        prompt: '选择弃掉的一名类人生物敌人。',
      }, humanoids)
      if (!target) return null
      const location = target.location
      api.discardEnemy(target)
      return location
    },
    onSpawnFailed(state, code, seat, api) {
      if (seat != null) api.drawEncounter(seat)
    },
  },
}
