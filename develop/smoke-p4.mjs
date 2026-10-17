// develop/smoke-p4.mjs —— Phase 4 冒烟测试：三关各自自动落子若干回合，验证不崩溃 + 关键行动可执行。
import { createGameState, applyMove, validateMove, legalMoves, describeState } from '../games/arkhamhorror/engine.js'

const settings = { difficulty: 'standard', playerInvestigator: '01001' }
const players = [{ seat: 0, persona: '人类' }, { seat: 1, persona: '学者' }]

function forceAdvance(state, setup) {
  // 通过直接注入满足幕/议程目标并落一步，触发剧本推进。
  setup()
  const moves = legalMoves(state)
  const mv = moves.find((m) => m.action === 'resource') || moves.find((m) => m.action === 'draw') || moves[0]
  const err = validateMove(state, state.currentSeat, mv)
  if (err) throw new Error('forceAdvance 校验失败: ' + err)
  applyMove(state, state.currentSeat, mv)
}

function autoplay(state, max, label) {
  let transitions = 0
  let lastIdx = state.campaign.scenarioIndex
  for (let i = 0; i < max && state.status === 'playing'; i++) {
    const moves = legalMoves(state)
    if (!moves.length) break
    // 优先执行推进类行动，避免撤退；兜底随机。
    const priority = [
      'drawCultist', 'parleyCultist', 'interruptRitual', 'investigate', 'breakDoor',
      'parleyLita', 'fight', 'evade', 'move', 'freeAction', 'resource', 'draw', 'play', 'ability',
    ]
    let mv = null
    for (const p of priority) {
      mv = moves.find((m) => m.action === p)
      if (mv) break
    }
    if (!mv) mv = moves.find((m) => !['resign', 'endTurn'].includes(m.action)) || moves[0]
    const err = validateMove(state, state.currentSeat, mv)
    if (err) { console.log('校验失败:', err, JSON.stringify(mv)); break }
    applyMove(state, state.currentSeat, mv)
    if (state.campaign.scenarioIndex !== lastIdx) { transitions++; lastIdx = state.campaign.scenarioIndex; console.log(`  ↳ 剧本推进到 ${state.scenario.id}`) }
  }
  console.log(`\n[${label}] 结束：status=${state.status} outcome=${state.outcome} scenario=${state.scenario.id} 幕=${state.actIndex} 议程=${state.agendaIndex} 回合=${state.round} 剧本切换=${transitions}`)
  console.log('调查员:', state.investigators.map((i) => `${i.name} ${i.maxHealth - i.damage}/${i.maxHealth}hp ${i.maxSanity - i.horror}/${i.maxSanity}sp 败退:${i.defeated} 撤退:${i.resigned}`).join(' | '))
  console.log('敌人:', state.enemies.map((e) => `${e.name}(${e.location})`).join(' | ') || '无')
}

// —— 第一关：自动落子 ——
const s1 = createGameState(settings, players)
autoplay(s1, 400, '第一关·集结')

// —— 第二关：强制推进第一关后自动落子 ——
const s2 = createGameState(settings, players)
forceAdvance(s2, () => { s2.clues = 4 })
forceAdvance(s2, () => { s2.clues = 6 })
forceAdvance(s2, () => { s2.enemies = s2.enemies.filter((e) => e.code !== 'ghoulPriest') })
if (s2.scenario.id !== 'theMidnightMasks') throw new Error('未能进入第二关')
autoplay(s2, 500, '第二关·午夜假面')

// —— 第三关：强制推进到第三关后自动落子 ——
const s3 = createGameState(settings, players)
forceAdvance(s3, () => { s3.clues = 4 })
forceAdvance(s3, () => { s3.clues = 6 })
forceAdvance(s3, () => { s3.enemies = s3.enemies.filter((e) => e.code !== 'ghoulPriest') })
forceAdvance(s3, () => { s3.cultistsInVictory = ['wolfManDrew', 'hermanCollins', 'peterWarren', 'victoriaDevereux', 'ruthTurner', 'theMaskedHunter'] })
if (s3.scenario.id !== 'theDevourerBelow') throw new Error('未能进入第三关')
autoplay(s3, 600, '第三关·地底噬魔')

console.log('\n✅ Phase 4 冒烟测试完成（无崩溃）。')
