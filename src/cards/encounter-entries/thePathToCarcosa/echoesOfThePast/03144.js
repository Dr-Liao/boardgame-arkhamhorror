// 03144 卡尔克萨探求者
// 归属：关卡专用 · echoesOfThePast（卡尔克萨之路 · 往事回声）
// 遭遇组：echoes_of_the_past
// 卡面：生成 - 任意无人历史协会地点。
// 卡面：冷漠。
// 卡面：强制 - 当神话阶段结束时：将卡尔克萨探求者所在地点的1个线索移动到卡尔克萨探求者上(如果你不能这么做，改为在卡尔克萨探求者上放置1个毁灭标记)。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 追寻者（03144）：神话阶段结束时把所在地点的 1 个线索移到它身上；不能则放 1 毁灭。

export default {
  code: '03144', scope: 'enemy',
  enemyScript: {
    onMythosEnd(state, enemy) {
      const location = (state.locations || []).find(candidate => candidate.id === enemy.location)
      if (location?.clues > 0) {
        location.clues--
        enemy.clues = (enemy.clues || 0) + 1
      } else enemy.doom = (enemy.doom || 0) + 1
    },
  },
}
