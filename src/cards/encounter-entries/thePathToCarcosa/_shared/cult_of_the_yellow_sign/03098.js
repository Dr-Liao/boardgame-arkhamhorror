// 03098 狂徒
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：cult_of_the_yellow_sign
// 卡面：生成 - 线索最多的已揭示地点。
// 卡面：强制 - 在狂徒入场后：将狂徒所在地点的1个线索移动到狂徒上。
// 卡面：强制 - 在你击败狂徒时：控制其所有线索。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { chooseEntryOption, flipEnemyCluesToDoom } from '../../../_shared.js'

export default {
  code: '03098', scope: 'enemy', implemented: true,
  enemyScript: {
    onSpawnLocation(state, code, fallback, seat, api) {
      const revealed = state.locations.filter(location => location.revealed)
      if (!revealed.length) return null
      const most = Math.max(...revealed.map(location => location.clues || 0))
      return chooseEntryOption(api, {
        kind: 'spawn', source: code, seat: seat ?? state.campaign.leadSeat,
        prompt: '选择线索最多的已揭示地点生成狂徒。',
      }, revealed.filter(location => (location.clues || 0) === most))?.id || null
    },
    onSpawn(state, enemy, api) {
      const location = state.locations.find(candidate => candidate.id === enemy.location)
      if (location?.clues > 0) {
        location.clues--
        enemy.clues = (enemy.clues || 0) + 1
        flipEnemyCluesToDoom(state, enemy)
      }
    },
    onDefeated(state, enemy, api) {
      if (!enemy.clues) return false
      const inv = state.investigators[enemy.defeatedBy]
      if (inv) api.gainClues(inv.seat, enemy.clues)
      enemy.clues = 0
      return false
    },
  },
}
