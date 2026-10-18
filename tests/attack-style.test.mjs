import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameState, applyMove } from '../src/engine/engine.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { attackStyle, ATTACK_STYLES } from '../src/integration/attack-style.js'

test('攻击演出按卡牌覆盖 → 特性种类 → 默认解析', () => {
  const style = code => attackStyle(ALL_CARDS[code])
  for (const code of ['01016', '01029', '01006', '02304']) assert.equal(style(code), 'firearm', code)
  for (const code of ['01020', '01086', '01044', '02036', '02032', '05118']) assert.equal(style(code), 'blade', code)
  for (const code of ['01074', '02016', '03110', '08093']) assert.equal(style(code), 'default', `${code} 是钝器`)
  assert.equal(style('02301'), 'lightning', '闪电枪覆盖枪械类')
  assert.equal(style('04305'), 'default', '火焰喷射器覆盖枪械类')
  assert.equal(style('04276'), 'blade', '古旧锈剑名称不含刀剑词，由覆盖指定')
  assert.equal(style('01060'), 'default', '法术不属于已实现种类')
  assert.equal(attackStyle(null), 'default')
  for (const card of Object.values(ALL_CARDS)) assert.ok(ATTACK_STYLES.includes(attackStyle(card)), card.code)
})

test('出手攻击事件公开武器卡号与演出样式', () => {
  const run = (weaponCode, success = true) => {
    const state = createGameState({ playerInvestigator: '01001', seed: 'attack-style' }, [{ seat: 0, name: 'P0' }])
    for (let i = 0; state.pendingChoice && i < 20; i++) {
      const option = state.pendingChoice.options.find(o => ['done', 'skip', 'self'].includes(o.id)) || state.pendingChoice.options[0]
      applyMove(state, state.pendingChoice.seat, { action: 'choose', choiceId: state.pendingChoice.id, optionId: option.id })
    }
    const inv = state.investigators[0]
    inv.hand = []; inv.actionsLeft = 3; state.chaosBag = [success ? '0' : 'autofail']
    const enemy = { id: 'e1', code: 'ghoulMinion', name: '测试敌人', fight: 2, evade: 2, health: 10, damageTaken: 0, damage: 1, horror: 0, exhausted: false, location: inv.location, engagedSeat: 0 }
    state.enemies.push(enemy); inv.engaged.push(enemy.id)
    const events = []
    if (weaponCode) {
      const weapon = { id: 'w1', code: weaponCode, exhausted: false, uses: 4, usesType: 'ammo' }
      inv.assets.push(weapon)
      events.push(...applyMove(state, 0, { action: 'ability', assetId: weapon.id, abilityIndex: 0, targetId: enemy.id }))
    } else events.push(...applyMove(state, 0, { action: 'fight', enemyId: enemy.id }))
    for (let i = 0; state.pendingChoice && i < 30; i++) {
      const option = state.pendingChoice.options.find(o => ['done', 'skip', 'self'].includes(o.id))
      events.push(...applyMove(state, state.pendingChoice.seat, { action: 'choose', choiceId: state.pendingChoice.id, optionId: option.id }))
    }
    return events.map(e => e.presentation || e).find(e => e.kind === 'attack' && e.direction === 'outgoing')
  }
  assert.deepEqual([run('01020')].map(a => [a.weaponCode, a.attackStyle]), [['01020', 'blade']])
  assert.deepEqual([run('01016')].map(a => [a.weaponCode, a.attackStyle]), [['01016', 'firearm']])
  assert.equal(run('01016', false).attackStyle, 'firearm', '落空同样使用枪械样式')
  const bare = run(null)
  assert.equal(bare.weaponCode, null); assert.equal(bare.attackStyle, 'default')
  assert.equal(run('02301').attackStyle, 'lightning')
})

test('炸药爆破在伤害前公开爆破演出，列出地点内全部目标', () => {
  const state = createGameState({ playerInvestigator: '01001', seed: 'attack-style' }, [{ seat: 0, name: 'P0' }, { seat: 1, name: 'P1' }])
  for (let i = 0; state.pendingChoice && i < 20; i++) {
    const option = state.pendingChoice.options.find(o => ['done', 'skip', 'self'].includes(o.id)) || state.pendingChoice.options[0]
    applyMove(state, state.pendingChoice.seat, { action: 'choose', choiceId: state.pendingChoice.id, optionId: option.id })
  }
  const [inv, ally] = state.investigators
  state.currentSeat = 0; inv.hand = ['01024']; inv.resources = 5; inv.actionsLeft = 3; ally.location = inv.location
  for (const id of ['e1', 'e2']) state.enemies.push({ id, code: 'ghoulMinion', name: '测试敌人', fight: 2, evade: 2, health: 10, damageTaken: 0, damage: 1, horror: 0, exhausted: false, location: inv.location, engagedSeat: null })
  const events = applyMove(state, 0, { action: 'play', cardId: '01024' })
  for (let i = 0; state.pendingChoice && i < 10; i++) {
    const choice = state.pendingChoice
    const option = choice.options.find(o => o.id === inv.location) || choice.options.find(o => ['done', 'skip', 'self'].includes(o.id)) || choice.options[0]
    events.push(...applyMove(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: option.id }))
  }
  const blast = events.map(e => e.presentation || e).find(e => e.kind === 'blast')
  assert.ok(blast, '必须产生爆破演出')
  assert.equal(blast.fx, 'dynamite'); assert.equal(blast.location, inv.location); assert.equal(blast.damage, 3)
  assert.deepEqual(blast.enemyIds, ['e1', 'e2']); assert.deepEqual(blast.seats, [0, 1])
  assert.ok(blast.tableState.enemies.every(enemy => enemy.damageTaken === 0), '演出快照停在伤害之前')
  assert.ok(state.enemies.every(enemy => enemy.damageTaken === 3))
})
