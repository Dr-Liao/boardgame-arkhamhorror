// 08043 通路档案
// 灵脉从支援的使用值移至敌人；解除交战和自动躲避是两个独立效果。
import { cardCounterOf } from '../../engine/card-counters.js'

const code = '08043'
const active = person => !person.defeated && !person.resigned
const targets = state => state.enemies.filter(enemy => !enemy.elite && !enemy.defeated)
const markedEnemies = (state, person) => state.enemies.filter(enemy =>
  !enemy.defeated && cardCounterOf(enemy, 'leyline') > 0
  && (enemy.engagedSeat === person.seat || (enemy.massive && !enemy.exhausted && enemy.location === person.location)))
const destinations = (state, person, canMove) => {
  const here = state.locations.find(location => location.id === person.location)
  return (here?.connections || []).filter(id => canMove(person.seat, id))
}
const eligibleInvestigators = (state, canMove) => state.investigators.filter(person => active(person)
  && markedEnemies(state, person).length && destinations(state, person, canMove).length)

export default {
  code,
  uses: 4,
  usesType: 'leyline',
  abilities: [
    {
      kind: 'entersPlay',
      label: '入场：获得 4 个灵脉',
      resolve: ({ source, api }) => { if (source) api.setAssetUses(source, 4) },
    },
    {
      kind: 'free',
      label: '从本支援移动 1 灵脉到一个非精英敌人',
      cost: { uses: 1 },
      criteria: ({ state }) => targets(state).length > 0,
      resolve: ({ state, inv, api }) => {
        const candidates = targets(state)
        if (!candidates.length) return
        const id = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: code, seat: inv.seat,
          prompt: '选择要放置灵脉的非精英敌人。',
          options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = candidates.find(item => item.id === id)
        if (enemy) api.addCardCounter(enemy, 'leyline')
      },
    },
    {
      kind: 'action',
      label: '解除和带灵脉敌人的交战并移动；可移除灵脉自动躲避',
      cost: { action: true },
      noOpportunityAttack: true,
      criteria: ({ state, helpers }) => eligibleInvestigators(state, helpers.canMoveTo).length > 0,
      resolve: ({ state, inv, api }) => {
        const candidates = eligibleInvestigators(state, api.canMoveTo)
        if (!candidates.length) return
        const seat = candidates.length === 1 ? candidates[0].seat : Number(api.choice({
          kind: 'investigator', source: code, seat: inv.seat,
          prompt: '选择与带有灵脉的敌人交战的调查员。',
          options: candidates.map(person => ({ id: String(person.seat), label: person.name })),
        }))
        const person = candidates.find(item => item.seat === seat)
        if (!person) return
        const enemies = markedEnemies(state, person)
        const enemyId = enemies.length === 1 ? enemies[0].id : api.choice({
          kind: 'target', source: code, seat: inv.seat,
          prompt: '选择要解除交战的带灵脉敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = enemies.find(item => item.id === enemyId)
        const locations = destinations(state, person, api.canMoveTo)
        if (!enemy || !locations.length) return
        const location = locations.length === 1 ? locations[0] : api.choice({
          kind: 'location', source: code, seat: inv.seat,
          prompt: '选择要移动到的连接地点。',
          options: locations.map(id => ({ id, label: api.locName(id) })),
        })
        if (!locations.includes(location)) return
        api.disengageEnemy(enemy)
        api.moveInvestigator(person.seat, location)
        if (cardCounterOf(enemy, 'leyline') === 0) return
        const remove = api.choice({ kind: 'effect', source: code, seat: inv.seat, canSkip: true,
          prompt: '是否移除该敌人的 1 灵脉来自动躲避？',
          options: [{ id: 'skip', label: '不移除' }, { id: 'remove', label: '移除灵脉并自动躲避' }],
        })
        if (remove === 'remove') {
          api.addCardCounter(enemy, 'leyline', -1)
          api.autoEvadeEnemy(enemy)
        }
      },
    },
  ],
  modifiers: [],
}
