// develop/smoke-test.mjs —— Phase 2 冒烟测试（临时脚本，可随时重建）
//
// 验证：createState / validateMove / applyMove / legalMoves / describeState 在
// 4 难度 × 5 调查员下均能正常创建状态、合法落子、推进至终局，且不抛异常。
// 用法：node develop/smoke-test.mjs

import { createGameState, applyMove, validateMove, legalMoves, describeState, performTest, allCardDefs } from '../games/arkhamhorror/engine.js'
import { buildDeck } from '../games/arkhamhorror/deckbuilding.js'
import { INVESTIGATORS, PLAYER_CARDS, BASIC_WEAKNESSES } from '../games/arkhamhorror/cards-data.js'
import { EFFECTS } from '../games/arkhamhorror/card-effects.js'

let failures = 0
function ok(cond, msg) {
  if (cond) console.log('  ✔ ' + msg)
  else { console.error('  ✘ ' + msg); failures++ }
}

const CORE = ['01001', '01002', '01003', '01004', '01005']
const DIFFS = ['easy', 'standard', 'hard', 'expert']

console.log('== 1. 牌组构筑 ==')
for (const code of CORE) {
  const inv = INVESTIGATORS[code]
  const built = buildDeck(inv, { seat: 0, seed: 123, playerPool: Object.values(PLAYER_CARDS).filter((c) => c.pack === 'core'), basicWeaknessPool: Object.values(BASIC_WEAKNESSES).filter((c) => c.pack === 'core' && c.code !== '01000').map((c) => c.code) })
  ok(built.playerCards.length === 30, `${code} 玩家卡 30 张（实际 ${built.playerCards.length}）`)
  ok(built.signatureCards.length === 1, `${code} 专属签名卡 1 张`)
  ok(built.signatureWeaknesses.length === 1, `${code} 专属弱点 1 张`)
  ok(built.basicWeaknesses.length === 1, `${code} 基础弱点 1 张`)
  ok(built.deck.length === 33, `${code} 总牌库 33 张（实际 ${built.deck.length}）`)
}

console.log('== 2. 效果编码统计 ==')
let encoded = 0, simplified = 0
for (const code of Object.keys(EFFECTS)) {
  encoded++
  if (EFFECTS[code].simplified) simplified++
}
console.log(`  已编码 ${encoded} 张（其中简化 ${simplified} 张）`)

console.log('== 3. 状态创建（4 难度 × 5 调查员） ==')
for (const diff of DIFFS) {
  for (const pick of CORE) {
    const state = createGameState({ difficulty: diff, playerInvestigator: pick, teammates: 2 }, [
      { seat: 0 }, { seat: 1, persona: '学者' }, { seat: 2, persona: '战士' },
    ])
    ok(state && state.status === 'playing', `${diff}/${pick} 创建成功`)
    ok(Array.isArray(state.legalMoves) && state.legalMoves.length > 0, `${diff}/${pick} 有合法行动`)
    const s = describeState(state)
    ok(typeof s === 'string' && s.length > 100, `${diff}/${pick} describeState 正常`)
  }
}

console.log('== 4. 技能检定 ==')
{
  const state = createGameState({ difficulty: 'standard', playerInvestigator: '01001', teammates: 2 }, [
    { seat: 0 }, { seat: 1, persona: '学者' }, { seat: 2, persona: '战士' },
  ])
  for (let i = 0; i < 100; i++) {
    const r = performTest(state, 0, 'combat', 3)
    if (!r || typeof r.success !== 'boolean') { ok(false, 'performTest 返回结构异常'); break }
  }
  ok(true, 'performTest 100 次无异常')
}

console.log('== 5. 全流程随机落子（直到终局或 2000 步） ==')
for (const diff of ['standard', 'expert']) {
  const state = createGameState({ difficulty: diff, playerInvestigator: 'auto', teammates: 3 }, [
    { seat: 0 }, { seat: 1, persona: '学者' }, { seat: 2, persona: '战士' }, { seat: 3, persona: '流浪' },
  ])
  let steps = 0
  const rngState = 42
  const rng = (() => { let a = rngState >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } })()
  while (state.status === 'playing' && steps < 2000) {
    const moves = legalMoves(state)
    if (!moves.length) { ok(false, `${diff} 无合法行动但状态 playing`); break }
    const move = moves[Math.floor(rng() * moves.length)]
    const err = validateMove(state, state.currentSeat, move)
    if (err) { ok(false, `${diff} 校验失败：${err}（${JSON.stringify(move)}）`); break }
    applyMove(state, state.currentSeat, move)
    steps++
  }
  ok(state.status !== 'playing', `${diff} 全流程到达终局（${steps} 步，outcome=${state.outcome}）`)
  if (state.status !== 'playing') console.log(`    → ${state.outcome}（胜利点 ${state.victory}，回合 ${state.round}）`)
}

console.log('== 6. allCardDefs ==')
const defs = allCardDefs()
ok(defs && Object.keys(defs).length > 800, `allCardDefs 含 ${Object.keys(defs).length} 张卡`)

console.log('')
if (failures) { console.error(`❌ 共 ${failures} 处失败`); process.exit(1) }
console.log('✅ 冒烟测试全部通过')
