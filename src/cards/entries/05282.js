// 05282 偷梁换柱
// 卡面：选择一项：
// - 躲避。如果你检定成功，且躲避的敌人非[[精英]]，躲避该敌人并将其移动到一个连接地点。
// - 躲避。只用于在连接地点的一个非[[精英]]敌人。如果你检定成功，躲避该敌人并与其交换地点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05282 偷梁换柱：两个躲避选项。
// 分支 A 走通用 doEvade 的 moveEnemyOnSuccess（引擎只对非精英敌人移动，与卡面一致）；
// 分支 B 是自己结算的敏捷检定（目标在连接地点、非精英），成功后横置该敌人并交换双方地点。

function connectorsOf(state, locationId) {
  const here = state.locations.find(location => location.id === locationId)
  return (here?.connections || []).map(id => state.locations.find(location => location.id === id)).filter(Boolean)
}

export default {
  code: '05282',
  // 卡面两项都以「躲避」为目标：没有可躲避的敌人（与本人交战，或位于连接地点的非精英）时不能打出。
  playCondition: [{
    when: ({ state, inv }) => (state.enemies || []).some(enemy => !enemy.defeated
      && (enemy.engagedSeat === inv.seat
        || (!enemy.elite && (state.locations.find(location => location.id === inv.location)?.connections || []).includes(enemy.location)))),
    message: '没有可以躲避的敌人（与你交战的敌人，或连接地点的非精英敌人），不能打出「偷梁换柱」',
  }],
  abilities: [
    {
      kind: 'played',
      label: '躲避并移动敌人 / 与连接地点的敌人换位',
      resolve: ({ state, inv, api }) => {
        const engaged = state.enemies.filter(enemy => enemy.engagedSeat === inv.seat)
        const connectors = connectorsOf(state, inv.location)
        const nearbyNonElite = state.enemies.filter(enemy => !enemy.elite && connectors.some(location => location.id === enemy.location))
        const options = []
        if (engaged.length) options.push({ id: 'evadeMove', label: '躲避与你交战的敌人；若它非精英，成功后再把它移到连接地点' })
        if (nearbyNonElite.length) options.push({ id: 'switch', label: '躲避连接地点的非精英敌人；成功后与其交换地点' })
        if (!options.length) { api.info('「偷梁换柱」：没有可躲避的敌人。'); return }
        const mode = options.length === 1 ? options[0].id : api.choice({ kind: 'effect', source: '05282', seat: inv.seat,
          prompt: '选择「偷梁换柱」的结算方式。', options })
        if (mode === 'evadeMove') {
          const target = engaged.length === 1 ? engaged[0] : state.enemies.find(enemy => enemy.id === api.choice({
            kind: 'target', source: '05282', seat: inv.seat, prompt: '选择要躲避的敌人。',
            options: engaged.map(enemy => ({ id: enemy.id, label: enemy.name })),
          }))
          if (!target) return
          api.evade(inv.seat, { enemyId: target.id, moveEnemyOnSuccess: true, sourceCode: '05282' })
          return
        }
        const target = nearbyNonElite.length === 1 ? nearbyNonElite[0] : state.enemies.find(enemy => enemy.id === api.choice({
          kind: 'target', source: '05282', seat: inv.seat, prompt: '选择连接地点的非精英敌人。',
          options: nearbyNonElite.map(enemy => ({ id: enemy.id, label: `${enemy.name}（${api.locationName(enemy.location)}）` })),
        }))
        if (!target) return
        const origin = inv.location
        const destination = target.location
        // 第六轮准备：引擎给 doEvade 加 allowConnecting/notEngaged 后，选项 B 走真实躲避流程
        // （躲避检定加成 + 揭示/成功窗口都与普通躲避一致）；原语未落地时 doEvade 会因
        // canEvade=false 返回 undefined（api-clue 的 evade 以 noSpend 调用），回落到窄口径 api.test。
        const realEvade = api.evade(inv.seat, { enemyId: target.id, sourceCode: '05282', allowConnecting: true, notEngaged: true })
        if (realEvade && typeof realEvade === 'object') {
          if (!realEvade.success) return
          api.exhaust(target)
          api.moveEnemy(target, origin)
          api.moveInvestigator(inv.seat, destination)
          api.info(`${inv.name} 躲避了「${target.name}」并与其交换了地点。`)
          return
        }
        const result = api.test(inv.seat, 'agility', api.enemyEvade(target), {
          source: { label: '躲避', name: target.name, code: '05282' },
        })
        if (!result?.success) return
        api.exhaust(target)
        api.moveEnemy(target, origin)
        api.moveInvestigator(inv.seat, destination)
        api.info(`${inv.name} 躲避了「${target.name}」并与其交换了地点。`)
      },
    },
  ],
  modifiers: [

  ],
}
