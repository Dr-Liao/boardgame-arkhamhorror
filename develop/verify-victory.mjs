// develop/verify-victory.mjs —— 验证「胜利」路径可达（临时脚本）
//
// 通过直接操纵 state（纯数据对象）构造「首领在场、调查员强攻」的局面，随后用
// applyMove 把首领打死，确认 checkOutcome 正确判定 victory。

import { createGameState, applyMove, validateMove, legalMoves } from '../games/arkhamhorror/engine.js'

const state = createGameState({ difficulty: 'standard', playerInvestigator: '01001', teammates: 0 }, [
  { seat: 0 },
])

// 直接推进到 act3（直面恐惧），并把首领放到地窖、与玩家交战。
state.actIndex = 2
state.investigators[0].location = 'cellar'
const boss = {
  id: 'e999', code: 'ghoulPriest', name: '食尸鬼祭司', fight: 4, evade: 4, health: 6,
  damage: 2, horror: 1, hunter: true, retaliate: true, elite: true, victory: 2,
  traits: ['Ghoul', 'Monster', 'Humanoid', 'Elite'], damageTaken: 0, exhausted: false,
  location: 'cellar', engagedSeat: 0,
}
state.enemies = [boss]
state.investigators[0].engaged = ['e999']
state.investigators[0].combat = 9 // 临时拉高战斗，确保能命中
state.investigators[0].health = 20
state.investigators[0].maxHealth = 20
state.investigators[0].sanity = 20
state.investigators[0].maxSanity = 20
state.investigators[0].actionsLeft = 3

let guard = 0
while (state.status === 'playing' && guard++ < 200) {
  const fight = legalMoves(state).find((m) => m.action === 'fight')
  if (!fight) break
  const err = validateMove(state, state.currentSeat, fight)
  if (err) { console.error('校验失败:', err); process.exit(1) }
  applyMove(state, state.currentSeat, fight)
}

console.log('最终状态:', state.status, '| outcome:', state.outcome, '| victory:', state.victory, '| actIndex:', state.actIndex)
if (state.status === 'over' && state.outcome === 'victory') {
  console.log('✅ 胜利路径验证通过')
} else {
  console.error('❌ 未到达胜利')
  process.exit(1)
}
