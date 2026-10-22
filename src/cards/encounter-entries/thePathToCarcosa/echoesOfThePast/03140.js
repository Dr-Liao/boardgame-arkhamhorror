// 03140 附身宣誓者
// 归属：关卡专用 · echoesOfThePast（卡尔克萨之路 · 往事回声）
// 遭遇组：echoes_of_the_past
// 卡面：猎手。反击。
// 卡面：场景1和场景2期间不能受到伤害。
// 卡面：强制 - 当敌军阶段开始时：调查员必须重整附身宣誓者或在其上放置1个毁灭标记。
// 卡面：目标 - 如果附身宣誓者被击败：(→结局3)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 附身宣誓者（03140）：密谋 2 之前免疫伤害；被击败时进胜利区并进入结局 3；敌军阶段开始累积毁灭。

export default {
  code: '03140', scope: 'enemy',
  enemyScript: {
    onDamaged(state, enemy) {
      if (state.actIndex < 2) enemy.damageTaken = 0
    },
    onDefeated(state, enemy, api) {
      if (!state.victoryDisplay.some(card => card.id === enemy.id)) {
        state.victoryDisplay.push({ ...structuredClone(enemy), originalCode: '03140', victory: 2 })
      }
      api.finish('r3')
      return true
    },
    onPhaseStart(state, enemy, api) {
      if (!enemy.exhausted) enemy.doom = (enemy.doom || 0) + 1
      else {
        const answer = api.choose({
          kind: 'enemy', source: enemy.id, seat: state.campaign.leadSeat,
          prompt: '附身宣誓者：重整它，或在其上放置 1 个毁灭标记。',
          options: [{ id: 'ready', label: '重整附身宣誓者' }, { id: 'doom', label: '放置 1 毁灭' }],
        })
        if (answer === 'ready') enemy.exhausted = false
        else enemy.doom = (enemy.doom || 0) + 1
      }
    },
  },
}
