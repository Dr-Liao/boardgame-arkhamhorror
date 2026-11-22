// 60366 迅速离场（Quick Exit，André Patel）
// 卡面：躲避（[agility]）。本次躲避你得到 +2[agility]。
//       如果你成功且超过难度至少 2 点，且被躲避的敌人为非[[精英]]，该敌人在下一个补给阶段期间不重整。
//
// 引擎读点：
//   · 躲避检定 = api.evade({ enemyId, bonus: 2, onSuccess })（doEvade 唯一入口，含躲避成功窗口）；
//     onSuccess 收到 { state, inv, enemy, result }，result 是本次检定的标准结果（value/difficulty/successBy）。
//   · 「下一个补给阶段不重整」= api.preventEnemyReadyNextUpkeep（scenario-runtime 的记载，
//     补给阶段重整扫描读同一份账）。
export default {
  code: '60366',
  abilities: [{
    kind: 'played',
    label: '躲避 +2 敏捷；成功超过 2 点的非精英敌人下个补给阶段不重整',
    resolve: ({ state, inv, api }) => {
      const targets = (state.enemies || []).filter(enemy => enemy.location === inv.location)
      if (!targets.length) {
        api.info('没有可躲避的敌人。')
        return
      }
      const chosen = targets.length === 1 ? targets[0].id : api.choice({
        kind: 'target', source: '60366', seat: inv.seat,
        prompt: '选择躲避目标。',
        options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = targets.find(item => item.id === chosen) || targets[0]
      api.evade(inv.seat, {
        enemyId: enemy.id, bonus: 2, sourceCode: '60366',
        onSuccess: ({ result, enemy: evaded }) => {
          const details = result?.summary ? { ...result, ...result.summary } : result
          const successBy = Number(details?.successBy
            ?? ((details?.value ?? 0) - (details?.difficulty ?? 0)))
          if (successBy >= 2 && !evaded?.elite) {
            api.preventEnemyReadyNextUpkeep(evaded)
            api.info(`「${evaded?.name || '敌人'}」在下一个补给阶段期间不重整。`)
          }
        },
      })
    },
  }],
}
