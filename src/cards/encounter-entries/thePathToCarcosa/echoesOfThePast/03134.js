// 03134 历史协会
// 归属：关卡专用 · echoesOfThePast（卡尔克萨之路 · 往事回声）
// 遭遇组：echoes_of_the_past
// 卡面：[action]：调查。如果你检定成功，不发现线索，改为选择一个有毁灭标记的敌人。拿取该敌人上的1个毁灭标记，将其翻至线索面，并将其放置到你的调查员上。(团队每轮仅限一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03134', scope: 'location', historicalRoom: true,
  locationRule: {
    actions({ state, moves }) {
      if (state.scenarioFlags.readingRoomRound === state.round) return
      moves.push({ action: 'scenarioAction', rule: 'readingRoom', label: '调查阅览室，将敌人上的毁灭转为线索',
        reason: state.enemies.some(enemy => (enemy.doom || 0) > 0) ? null : '场上没有带毁灭的敌人' })
    },
  },
}
