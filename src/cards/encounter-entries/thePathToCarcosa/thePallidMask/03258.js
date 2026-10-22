// 03258 地下墓穴讲师
// 归属：关卡专用 · thePallidMask（卡尔克萨之路 · 苍白面具）
// 遭遇组：the_pallid_mask
// 卡面：生成 - 最近的未揭示地点。
// 卡面：[action]：谈判。检定[intellect](4)以解读这位导师的疯话。如果你检定成功，查看场上任意一个地下墓穴地点的已揭示面。(FAQ，v1.3)(团队每场游戏仅限一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { chooseEntryOption, entryDistance } from '../../_shared.js'

export default {
  code: '03258', scope: 'enemy', implemented: true,
  enemyScript: {
    encounterAction(state, inv, enemy) {
      if (state.scenarioFlags?.catacombsLecturerUsed) return null
      return {
        action: 'encounterAction', actionKind: 'parley', rule: 'parleyLecturer',
        enemyId: enemy.id, actions: 1, label: '谈判地下墓穴讲师（智识4）',
      }
    },
    onSpawnLocation(state, code, fallback, seat, api) {
      const origin = state.investigators[seat]?.location || fallback
      const unrevealed = state.locations.filter(location => !location.revealed)
      if (!unrevealed.length) return null
      const nearest = Math.min(...unrevealed.map(location => entryDistance(state, origin, location.id)))
      return chooseEntryOption(api, {
        kind: 'spawn', source: code, seat: seat ?? state.campaign.leadSeat,
        prompt: '选择最近的未揭示地点生成地下墓穴讲师。',
      }, unrevealed.filter(location => entryDistance(state, origin, location.id) === nearest))?.id || null
    },
  },
}
