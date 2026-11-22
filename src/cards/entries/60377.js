// 60377 迅速离场（升级版，André Patel，2 XP）
// 卡面：躲避（[agility]）。本次检定将你的[willpower]加入你的[agility]。
//       如果你成功且被躲避的敌人为非[[精英]]，该敌人在下一个补给阶段期间不重整。
//
// 引擎读点：
//   · 躲避检定 = api.evade({ enemyId, addSkill: 'willpower', onSuccess })（doEvade 唯一入口）；
//   · 「下一个补给阶段不重整」= api.preventEnemyReadyNextUpkeep（scenario-runtime 的记载，
//     补给阶段重整扫描读同一份账）。
export default {
  code: '60377',
  abilities: [{
    kind: 'played',
    label: '躲避（敏捷 + 意志）；成功的非精英敌人下个补给阶段不重整',
    resolve: ({ state, inv, api }) => {
      const targets = (state.enemies || []).filter(enemy => enemy.location === inv.location)
      if (!targets.length) {
        api.info('没有可躲避的敌人。')
        return
      }
      const chosen = targets.length === 1 ? targets[0].id : api.choice({
        kind: 'target', source: '60377', seat: inv.seat,
        prompt: '选择躲避目标。',
        options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = targets.find(item => item.id === chosen) || targets[0]
      api.evade(inv.seat, {
        enemyId: enemy.id, addSkill: 'willpower', sourceCode: '60377',
        onSuccess: () => {
          if (enemy.elite) return
          api.preventEnemyReadyNextUpkeep(enemy)
          api.info(`「${enemy.name}」在下一个补给阶段期间不重整。`)
        },
      })
    },
  }],
}
