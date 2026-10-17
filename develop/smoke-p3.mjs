// develop/smoke-p3.mjs —— Phase 3 冒烟测试：核心包完整开局 + 自动落子跑若干回合。
import { createGameState, applyMove, validateMove, legalMoves, describeState } from '../games/arkhamhorror/engine.js'
import { coreEffectCodes } from '../games/arkhamhorror/card-effects.js'
import { EFFECTS, INVESTIGATOR_ABILITIES } from '../games/arkhamhorror/card-effects.js'
import { ALL_CARDS, PLAYER_CARDS, BASIC_WEAKNESSES, INVESTIGATORS } from '../games/arkhamhorror/cards-data.js'

// 3.5 校验：核心包应编码效果的卡都有 EFFECTS 条目。
const missing = coreEffectCodes().filter((c) => !EFFECTS[c])
console.log('coreEffectCodes 总数:', coreEffectCodes().length)
console.log('缺失 EFFECTS 的核心卡:', missing.length ? missing : '无')
console.log('调查员异能:', Object.keys(INVESTIGATOR_ABILITIES))

// 核心包玩家卡（含 XP）是否全部有 EFFECTS 或为技能牌。
const coreCards = Object.values(PLAYER_CARDS).filter((c) => c.pack === 'core')
const noEffect = coreCards.filter((c) => !EFFECTS[c.code] && !(c.type === 'skill'))
console.log('核心包玩家卡总数:', coreCards.length, '；无效果条目（非技能）:', noEffect.map((c) => c.code))

// 核心基础弱点（非敌人）是否有 EFFECTS。
const coreWeak = Object.values(BASIC_WEAKNESSES).filter((c) => c.pack === 'core' && c.code !== '01000')
console.log('核心基础弱点:', coreWeak.map((c) => c.code + ':' + c.type).join(', '))

const settings = { difficulty: 'standard', playerInvestigator: '01001', teammates: 2 }
const players = [{ seat: 0, persona: '人类' }, { seat: 1, persona: '学者' }, { seat: 2, persona: '战士' }]
const state = createGameState(settings, players)

console.log('\n=== 初始状态 ===')
console.log('调查员:', state.investigators.map((i) => `${i.name}(${i.code}) 位置${i.location} 生命${i.maxHealth - i.damage}/${i.maxHealth} 理智${i.maxSanity - i.horror}/${i.maxSanity}`).join(' | '))
console.log('地点:', state.locations.map((l) => `${l.name}(${l.id}) 帷幕${l.shroud} 线索${l.clues}`).join(' | '))
console.log('遭遇牌堆:', state.encounterDeck.length, '张')
console.log('混乱袋:', state.chaosBag.length, '枚')

// 自动落子（随机选合法行动）跑最多 N 步。
let guard = 0
const MAX = 400
while (state.status === 'playing' && guard++ < MAX) {
  const moves = legalMoves(state)
  if (!moves.length) break
  // 自动落子（优先推进，避免撤退）跑最多 N 步。
  const mv = moves.find((m) => m.action === 'investigate')
    || moves.find((m) => m.action === 'parleyLita')
    || moves.find((m) => m.action === 'freeAction')
    || moves.find((m) => !['resign', 'endTurn'].includes(m.action))
    || moves[0]
  const err = validateMove(state, state.currentSeat, mv)
  if (err) { console.log('校验失败:', err, JSON.stringify(mv)); break }
  applyMove(state, state.currentSeat, mv)
}

console.log('\n=== 终态（' + guard + ' 步）===')
console.log('状态:', state.status, '| 结局:', state.outcome, '| 解析:', state.resolution, '| 回合:', state.round, '| 幕:', state.actIndex, '| 议程:', state.agendaIndex, '| 毁灭:', state.doom, '| 线索:', state.clues, '| 胜利点:', state.victory)
console.log('调查员:', state.investigators.map((i) => `${i.name} 生命${i.maxHealth - i.damage}/${i.maxHealth} 理智${i.maxSanity - i.horror}/${i.maxSanity} 败退:${i.defeated} 撤退:${i.resigned}`).join(' | '))
console.log('地点:', state.locations.map((l) => `${l.name} 线索${l.clues}`).join(' | '))
console.log('敌人:', state.enemies.map((e) => `${e.name}(${e.location})`).join(' | ') || '无')
console.log('威胁区域:', state.investigators.map((i) => `${i.name}:${i.threat.map((t) => t.code).join(',') || '-'}`).join(' | '))
console.log('\n=== 最近日志 ===')
console.log(state.log.slice(-15).join('\n'))
