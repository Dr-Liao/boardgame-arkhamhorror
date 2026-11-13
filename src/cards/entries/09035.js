// 09035 手铐（Handcuffs）· 守卫者资产（2 级）· 快速 · 费用 1。
// 卡面：快速。
//       [action] 如果手铐没有附属到敌人：躲避。只用于[[类人]]敌人。本次躲避尝试不使用[agility]，
//       改为使用[combat]。如果你检定成功，移除刚刚躲避的敌人所有的毁灭标记，并将手铐附属到该敌人。
//       如果附属的敌人非[[精英]]，其不能重整，也不能在其上放置毁灭标记。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：
//   · 行动：候选 = 同地点[[类人]]敌人（api.cardTraits 读敌人印刷特性）；躲避用 api.evade
//     ({ skill: 'combat' })，成功后 removeDoomFromCard(enemy, 99) 清空毁灭并
//     api.attachSelfTo('09035', enemy.id)（该原语把支援附属到敌人、横置并脱离交战）；
//   · 「非精英不能重整」用 api.preventEnemyReady(enemy)（读点 scenario-runtime.preventEnemyReady）。
// approximation： 「不能在其上放置毁灭标记」没有「按来源禁止放毁灭」的持续读点，未实现（见 note）。
const SOURCE = '09035'
const humanoid = (api, code) => (api.cardTraits(code) || []).some(trait => String(trait).toLowerCase() === 'humanoid')
const attachedToEnemy = (state, inv) => (state.enemies || []).some(enemy => (enemy.attachments || [])
  .some(card => card.code === SOURCE))

export default {
  code: '09035',
  fast: true,
  note: 'approximation: 「附属的非精英敌人不能在其上放置毁灭标记」缺按来源禁止放毁灭的持续读点，未实现（不能重整已由 preventEnemyReady 实现）',
  abilities: [
    {
      kind: 'action',
    countsAs: 'evade',
      label: '躲避[[类人]]敌人（用[combat]）；成功后移除其全部毁灭并附属手铐',
      cost: { action: true },
      criteria: [({ state, inv }) => !attachedToEnemy(state, inv)],
      resolve: ({ state, inv, api }) => {
        const targets = api.enemiesAt(inv.location).filter(enemy => humanoid(api, enemy.code))
        if (!targets.length) {
          api.info('手铐：这里没有[[类人]]敌人。')
          return
        }
        const chosen = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'target', source: SOURCE, seat: inv.seat,
          prompt: '手铐：选择要躲避的[[类人]]敌人。',
          options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = state.enemies.find(item => item.id === chosen) || targets[0]
        api.evade(inv.seat, {
          enemyId: enemy.id, skill: 'combat',
          onSuccess: () => {
            api.removeDoomFromCard(enemy, 99)
            api.attachSelfTo(SOURCE, enemy.id)
            if (!enemy.elite) api.preventEnemyReady(enemy)
            api.info(`手铐：铐住「${enemy.name}」，移除其全部毁灭${enemy.elite ? '' : '（非精英：不能重整）'}。`)
          },
        })
      },
    },
  ],
  modifiers: [],
}
