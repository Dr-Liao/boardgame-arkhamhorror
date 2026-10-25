// 05113 驱除
// 卡面：躲避。只用于非[[精英]]敌人。本次躲避尝试不使用[agility]，改为使用[willpower]。
// 如果检定成功，将刚才躲避的敌人移动到场上任意一个地点。
// 如果检定成功且本次躲避尝试期间揭示了[skull]、[cultist]、[tablet]或[elder_thing]符号，
// 该敌人在下一个补给阶段期间不重整。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// P7：意志躲避走 api.evade({ skill: 'willpower' })（04232/04271 的同一通道）。
// 成功后的「移动到任意地点」用 api.moveEnemy；符号 → 下个补给阶段不重整写引擎已有的
// enemy.preventReady 读点（phases.js 的重整段；引擎暂未提供 ctx.api 包装）。
// 「只用于非精英」写成 playCondition：没有可躲避的非精英敌人时打不出去。
// 卡面「躲避。」= Evade 行动关键字：按 05020/05118 同一写法在 played 描述子上声明
// countsAs:'evade' + noOpportunityAttack（dispatch 的 playFlag 读点），不引发借机攻击。

const TOWER_SYMBOLS = ['skull', 'cultist', 'tablet', 'elderthing']

function evadableNonElite(state, inv) {
  return state.enemies.filter(enemy => !enemy.elite
    && (enemy.engagedSeat === inv.seat || (enemy.massive && enemy.location === inv.location)))
}

export default {
  code: '05113',
  playCondition: [{
    when: ({ state, inv }) => evadableNonElite(state, inv).length > 0,
    message: '没有可躲避的非精英敌人',
  }],
  abilities: [
    {
      kind: 'played', label: '意志躲避非精英敌人，成功后移动到任意地点',
      // 卡面「躲避。」= Evade 行动：本次打出不引发借机攻击（生命周期钩子的关键字读点是
      // lifecycle.playFlag → dispatch.js 的 playNoAoO）。
      countsAs: 'evade',
      noOpportunityAttack: true,
      resolve: ({ state, inv, api }) => {
        const targets = evadableNonElite(state, inv)
        if (!targets.length) { api.info('没有可躲避的非精英敌人。'); return }
        const chosen = targets.length === 1 ? targets[0].id
          : api.choice({ kind: 'target', source: '05113', seat: inv.seat,
            prompt: '选择要躲避的非精英敌人。', options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        api.evade(inv.seat, { enemyId: chosen, skill: 'willpower' })
        const result = api.testResult()
        const enemy = state.enemies.find(item => item.id === chosen)
        if (!result?.success || !enemy) return
        const locations = state.locations.filter(location => location.inPlay !== false)
        if (!locations.length) return
        const destination = locations.length === 1 ? locations[0].id
          : api.choice({ kind: 'move', source: '05113', seat: inv.seat,
            prompt: `选择「${enemy.name}」移动到场上任意一个地点。`,
            options: locations.map(location => ({ id: location.id, label: api.locName(location.id) })) })
        api.moveEnemy(enemy, destination)
        api.info(`「${enemy.name}」被移动到「${api.locName(destination)}」。`)
        // 符号 → 下一个补给阶段不重整。preventReady 是引擎在重整段唯一读的字段
        // （rounds/from 与 combat.js 的 skipReadyRounds 同形状）。
        if ((result.drawn || []).some(token => TOWER_SYMBOLS.includes(token))) {
          enemy.preventReady = { rounds: 1, from: state.round }
          api.info(`「${enemy.name}」在下一个补给阶段期间不重整。`)
        }
      },
    },
  ],
  modifiers: [],
}
