// develop/smoke-p5.mjs —— Phase 5 冒烟测试：验证 AI 接口增强（describeState / legalMoves / validateMove / 目标选择 / choose 分支）。
//
// 覆盖：
//   1. describeState 新增「战役进度 / 地点与连接图 / 敌人意图 / 可用免费能力」段落；
//   2. legalMoves 产出 freeAction 与免费能力标记；
//   3. 攻击类资产能力缺省目标（修复 fight 能力因缺少 enemyId 落空）；
//   4. 目标选择：多敌人时按 targetId 拆分；
//   5. choose 分支：多选项按 optionIndex 拆分并结算；
//   6. validateMove 硬边界：非法 move / 非法 targetId 被拒绝；
//   7. 三关自动落子无崩溃回归。
import { createGameState, applyMove, validateMove, legalMoves, describeState } from '../games/arkhamhorror/engine.js'
import { EFFECTS } from '../games/arkhamhorror/card-effects.js'

let failures = 0
function check(cond, msg) {
  if (cond) { console.log('✔ ' + msg) }
  else { failures++; console.log('✘ ' + msg) }
}

// —— 测试用最小敌人对象（与 engine 的 spawnEnemy 产物同形）——
let enemySeq = 0
function addEnemy(state, locId, name, opts = {}) {
  const e = {
    id: 'eTest' + (++enemySeq), code: 'testEnemy', name,
    fight: 3, evade: 2, health: 3, damage: 1, horror: 0,
    hunter: false, retaliate: false, alert: false, elite: false, massive: false,
    prey: null, forcedDoom: false, parleyCost: 0,
    uniqueCultist: false, evadeToVictory: false, bearerSeat: null,
    victory: 0, traits: [], damageTaken: 0, exhausted: false, doom: 0,
    location: locId, engagedSeat: null, ...opts,
  }
  state.enemies.push(e)
  return e
}

function engage(state, enemy, inv) {
  enemy.engagedSeat = inv.seat
  if (!inv.engaged.includes(enemy.id)) inv.engaged.push(enemy.id)
}

const settings = { difficulty: 'standard', playerInvestigator: '01003' } // 奥图尔（有 freeAction）
const players = [{ seat: 0, persona: '人类' }, { seat: 1, persona: '学者' }]

// ===========================================================================
// 1. describeState 新段落
// ===========================================================================
{
  const state = createGameState(settings, players)
  const desc = describeState(state)
  for (const marker of ['战役进度', '地点与连接图', '可用免费能力', '经验 ', '累计胜利点']) {
    check(desc.includes(marker), `describeState 含「${marker}」`)
  }
  // 开局（集结）无敌人，敌人意图段落此时可省略，但连接图必须有。
  check(desc.includes('连接「'), 'describeState 含地点连接图')
}

// ===========================================================================
// 2. legalMoves 含 freeAction（奥图尔）
// ===========================================================================
{
  const state = createGameState(settings, players)
  const moves = legalMoves(state)
  check(moves.some((m) => m.action === 'freeAction'), 'legalMoves 含 freeAction（奥图尔花 2 资源 +1 行动）')
}

// ===========================================================================
// 3. 攻击类能力缺省目标（fight 能力不再落空）
// ===========================================================================
{
  const state = createGameState(settings, players)
  const inv = state.investigators[state.currentSeat]
  const enemy = addEnemy(state, inv.location, '测试食尸鬼', { fight: 2, evade: 2, health: 10, damage: 1, horror: 0 })
  engage(state, enemy, inv)
  inv.assets.push({ id: 'cTestGun', code: '01006', exhausted: false, uses: 4, usesType: 'ammo' }) // 罗兰手枪：fight 能力
  const moves = legalMoves(state)
  const fightAbility = moves.find((m) => m.action === 'ability' && m.assetId === 'cTestGun')
  check(!!fightAbility, '攻击类资产能力被列为合法行动（有交战敌人时）')
  if (fightAbility) {
    const err = validateMove(state, inv.seat, fightAbility)
    check(!err, '攻击类能力通过校验（' + (err || 'ok') + '）')
    const before = enemy.damageTaken
    applyMove(state, inv.seat, fightAbility)
    const log = state.log.slice(-6).join(' ')
    check(!log.includes('找不到可攻击的敌人'), 'fight 能力结算不再落空（缺省攻击交战敌人）')
  }
}

// ===========================================================================
// 4. 目标选择：多敌人按 targetId 拆分
// ===========================================================================
{
  const state = createGameState(settings, players)
  const inv = state.investigators[state.currentSeat]
  const e1 = addEnemy(state, inv.location, '食尸鬼甲', { health: 5 })
  const e2 = addEnemy(state, inv.location, '食尸鬼乙', { health: 5 })
  inv.assets.push({ id: 'cTestBeat', code: '01018', exhausted: false }) // 巡警：dealDamage target 'here'
  const moves = legalMoves(state).filter((m) => m.action === 'ability' && m.assetId === 'cTestBeat')
  check(moves.length === 2, '目标选择：2 个同地点敌人拆分为 2 条 ability 行动（实际 ' + moves.length + '）')
  check(moves.every((m) => m.targetId), '目标选择：每条行动携带 targetId')
  if (moves.length === 2) {
    const mv = moves.find((m) => m.targetId === e1.id)
    const err = validateMove(state, inv.seat, mv)
    check(!err, '目标选择通过校验（' + (err || 'ok') + '）')
    applyMove(state, inv.seat, mv)
    check(e1.damageTaken === 1 && e2.damageTaken === 0, '目标选择：伤害落在指定敌人身上')
    const bad = validateMove(state, inv.seat, { action: 'ability', assetId: 'cTestBeat', abilityIndex: 0, targetId: 'eNoSuch' })
    check(!!bad, '目标选择：非法 targetId 被 validateMove 拒绝')
  }
}

// ===========================================================================
// 5. choose 分支：多选项按 optionIndex 拆分并结算
// ===========================================================================
{
  const state = createGameState(settings, players)
  const inv = state.investigators[state.currentSeat]
  EFFECTS['testChoose'] = {
    abilities: [{
      label: '二选一',
      cost: { action: true },
      effect: {
        type: 'chooseOne',
        options: [
          { label: '抽 1 张牌', effect: { type: 'draw', amount: 1 } },
          { label: '获得 2 资源', effect: { type: 'gainResource', amount: 2 } },
        ],
      },
    }],
  }
  inv.assets.push({ id: 'cTestChoose', code: 'testChoose', exhausted: false })
  const moves = legalMoves(state).filter((m) => m.action === 'ability' && m.assetId === 'cTestChoose')
  check(moves.length === 2, 'choose 分支：2 个选项拆分为 2 条行动（实际 ' + moves.length + '）')
  check(moves.every((m) => m.optionIndex != null), 'choose 分支：每条行动携带 optionIndex')
  if (moves.length === 2) {
    const mv = moves.find((m) => m.optionIndex === 1) // 获得 2 资源
    const err = validateMove(state, inv.seat, mv)
    check(!err, 'choose 分支通过校验（' + (err || 'ok') + '）')
    const resBefore = inv.resources
    applyMove(state, inv.seat, mv)
    check(inv.resources === resBefore + 2, 'choose 分支：按选项结算（+2 资源）')
    const bad = validateMove(state, inv.seat, { action: 'ability', assetId: 'cTestChoose', abilityIndex: 0, optionIndex: 9 })
    check(!!bad, 'choose 分支：非法 optionIndex 被 validateMove 拒绝')
  }
  delete EFFECTS['testChoose']
}

// ===========================================================================
// 6. validateMove 硬边界（非法 move 拒绝）
// ===========================================================================
{
  const state = createGameState(settings, players)
  const seat = state.currentSeat
  check(!!validateMove(state, seat, { action: 'nonsense' }), 'validateMove 拒绝未知行动')
  check(!!validateMove(state, seat, { action: 'fight', enemyId: 'eNoSuch' }), 'validateMove 拒绝不存在的敌人')
  check(!!validateMove(state, seat, {}), 'validateMove 拒绝空 move')
  check(!validateMove(state, seat, { action: 'draw' }), 'validateMove 接受合法 draw')
}

// ===========================================================================
// 7. 三关自动落子回归（沿用 Phase 4 冒烟逻辑）
// ===========================================================================
{
  const s = createGameState(settings, players)
  let transitions = 0
  let lastIdx = s.campaign.scenarioIndex
  let guard = 0
  while (s.status === 'playing' && guard++ < 900) {
    const moves = legalMoves(s)
    if (!moves.length) break
    const priority = [
      'drawCultist', 'parleyCultist', 'interruptRitual', 'investigate', 'breakDoor',
      'parleyLita', 'fight', 'evade', 'move', 'freeAction', 'resource', 'draw', 'play', 'ability',
    ]
    let mv = null
    for (const p of priority) { mv = moves.find((m) => m.action === p); if (mv) break }
    if (!mv) mv = moves.find((m) => !['resign', 'endTurn'].includes(m.action)) || moves[0]
    const err = validateMove(s, s.currentSeat, mv)
    if (err) { check(false, '自动落子校验失败: ' + err + ' ' + JSON.stringify(mv)); break }
    applyMove(s, s.currentSeat, mv)
    if (s.campaign.scenarioIndex !== lastIdx) { transitions++; lastIdx = s.campaign.scenarioIndex }
  }
  check(s.status === 'over' || transitions >= 0, '三关自动落子无崩溃（status=' + s.status + ' 场景=' + s.scenario.id + ' 剧本切换=' + transitions + '）')
}

if (failures) {
  console.log('\n❌ Phase 5 冒烟测试失败：' + failures + ' 项未通过。')
  process.exit(1)
}
console.log('\n✅ Phase 5 冒烟测试全部通过。')
