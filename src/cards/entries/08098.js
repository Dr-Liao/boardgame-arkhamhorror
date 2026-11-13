// 08098 远古海图（1 级）
// 卡面：使用(3秘密)。
//       [free]在你回合期间，横置远古海图并花费1秘密：选择并执行以下一个行动(移动、躲避或调查)。
//
// 读点：api.moveDestinations/api.moveInvestigator（移动）、api.evade（躲避）、api.investigate（调查）
// 都是不消耗行动的免费执行入口；费用走 cost { action:false, exhaust:true, uses:1 }。
// 「在你回合期间」= criteria: [ownTurn()]：玩家窗口会向所有调查员询问免费能力，
// 缺 criteria 时这张卡在别人的回合里也会被列出来（与 02108 探路者同一类漏网）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。

import { ownTurn } from '../../engine/matcher.js'

const chooseAction = (inv, state, api) => {
  const engaged = state.enemies.filter(enemy => inv.engaged.includes(enemy.id) && !enemy.exhausted && !enemy.defeated)
  const options = [{ id: 'move', label: '移动' }, { id: 'investigate', label: '调查' }]
  if (engaged.length) options.push({ id: 'evade', label: '躲避' })
  const picked = api.choice({ kind: 'effect', source: '08098', seat: inv.seat, prompt: '选择要执行的行动。', options })
  if (picked === 'move') {
    const destinations = api.moveDestinations(inv.seat)
    if (!destinations.length) return false
    const destination = destinations.length === 1 ? destinations[0] : api.choice({ kind: 'location', source: '08098', seat: inv.seat,
      prompt: '选择移动目的地。', options: destinations.map(id => ({ id, label: api.locName(id) })) })
    api.moveInvestigator(inv.seat, destination)
    return true
  }
  if (picked === 'evade') {
    const enemyId = engaged.length === 1 ? engaged[0].id : api.choice({ kind: 'target', source: '08098', seat: inv.seat,
      prompt: '选择要躲避的敌人。', options: engaged.map(enemy => ({ id: enemy.id, label: enemy.name })) })
    api.evade(inv.seat, { enemyId })
    return true
  }
  api.investigate(inv.seat)
  return true
}

export default {
  code: '08098',
  uses: 3,
  usesType: 'secrets',
  abilities: [
    { kind: 'free', label: '横置并花费 1 秘密：执行一个移动/躲避/调查行动', cost: { action: false, exhaust: true, uses: 1 },
      criteria: [ownTurn()],
      resolve: ({ inv, state, api }) => { chooseAction(inv, state, api) } },
  ],
  modifiers: [],
}
