// develop/verify-victory-p3.mjs —— 第一关「集结」胜利路径验证：
// 幕 1 → 幕 2 → 击败食尸鬼祭司 → 推进到第二关「午夜假面」（战役继续）。
// （Phase 4 起三关战役连动，击败首领后不再单局结束，故本脚本校验「进入第二关」。）
import { createGameState, applyMove, validateMove } from '../games/arkhamhorror/engine.js'

const settings = { difficulty: 'standard', playerInvestigator: '01001', teammates: 0 }
const players = [{ seat: 0, persona: '人类' }]
const state = createGameState(settings, players)
const seat = 0

function apply(action) {
  const err = validateMove(state, seat, action)
  if (err) throw new Error('校验失败: ' + err + ' ' + JSON.stringify(action))
  applyMove(state, seat, action)
}

// 幕 1：直接集齐 2 线索/人，落一步触发推进（打开走廊、移除书房）。
state.clues = 2
apply({ action: 'resource' })
if (state.actIndex !== 1) throw new Error('应在幕 2')
console.log('✔ 幕 1 推进：', state.locations.map((l) => l.name).join('、'))

// 幕 2：集齐 3 线索/人，落一步触发推进（揭示客厅 + 生成食尸鬼祭司 + 丽塔）。
state.clues = 3
apply({ action: 'resource' })
if (state.actIndex !== 2) throw new Error('应在幕 3')
if (!state.enemies.some((e) => e.code === 'ghoulPriest')) throw new Error('应生成食尸鬼祭司')
console.log('✔ 幕 2 推进：', state.enemies.map((e) => e.name).join('、'))

// 幕 3：击败食尸鬼祭司 → 结局 R2 → 推进到第二关。
state.enemies = state.enemies.filter((e) => e.code !== 'ghoulPriest')
apply({ action: 'resource' })
if (state.scenario.id !== 'theMidnightMasks') throw new Error('应进入第二关')
if (state.campaign.scenarioIndex !== 1) throw new Error('战役索引应为 1')
console.log('✔ 击败食尸鬼祭司 → 进入第二关「' + state.scenario.name + '」，经验 ' + state.campaign.xp)

console.log('\n✅ 第一关胜利路径验证通过（已推进到第二关）。')
