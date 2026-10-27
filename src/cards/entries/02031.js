// 02031 困兽之笼
// 卡面：躲避。本次躲避尝试不使用[agility]，改为使用[willpower]。如果你检定成功且该敌人非[[精英]]，躲避该敌人并将困兽之笼附属到该敌人。
// 卡面：[reaction]在附属的敌人将要重整时：检定[willpower](3)。如果你检定成功，附属的敌人不重整。如果你检定失败，弃掉困兽之笼。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 2026-10-27 修复（白吞卡）：「躲避。」事件必须有可绑定的敌人才能结算。旧实现无目标时只写
// 一行日志就弃牌，费用/行动照付。补 playCondition，并与 resolve 共用同一份候选。

function bindableEnemies(state, inv) {
  return state.enemies.filter(enemy => enemy.location === inv.location && !enemy.bindMonster)
}

export default {
  code: '02031',
  playCondition: [{
    when: ({ state, inv }) => bindableEnemies(state, inv).length > 0,
    message: '所在地点没有可绑定的敌人',
  }],
  abilities: [
    // Phase 5（5a-25）：卡号随效果数据走；第 4 批改成条目 resolve。
    {
      kind: 'played', label: '困兽之笼',
      // 卡面「躲避。」= Evade 行动：打出按躲避结算，不引发借机攻击。
      countsAs: 'evade',
      resolve: ({ state, inv, api }) => {
        // 卡面：任何敌人均可尝试躲避；只有非精英才会被附属。
        const candidates = bindableEnemies(state, inv)
        if (!candidates.length) { api.info('本地点没有可绑定的敌人。'); return }
        const id = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: '02031', seat: inv.seat, prompt: '选择要绑定的敌人。',
          options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = candidates.find(item => item.id === id)
        if (!enemy) return
        api.test(inv.seat, 'willpower', api.enemyEvade(enemy, inv.seat), {
          source: { label: '绑定怪物', name: enemy.name, code: '02031' },
          resolve: result => {
            if (!result.success || !state.enemies.includes(enemy)) return
            if (enemy.elite) {
              api.autoEvade(enemy)
              api.info(`「${enemy.name}」是精英，仍被躲避，但「困兽之笼」不能附属。`)
              return
            }
            api.bindMonsterToEnemy(enemy, inv.seat, '02031')
            api.info(`「绑定怪物」附属于「${enemy.name}」；它被躲避，不能移动，并在重整阶段保持横置。`)
          },
        })
      },
    },
  ],
  modifiers: [

  ],
}
