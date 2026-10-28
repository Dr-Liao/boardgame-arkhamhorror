// 04303 古代遗物（升级版）
// 卡面：[free]横置古代遗物：检定[意志]或[智识](4)。如果你检定成功，移除场上任一卡牌上的 1 个毁灭标记。
// （每场游戏最多一次成功。）
//
// 一张卡一个文件：这张卡的行为只在这里维护。

export default {
  code: '04303',
  abilities: [
    {
      kind: 'free', label: '横置：意志/智识(4)，成功移除任一卡牌上的 1 毁灭',
      cost: { action: false, exhaust: true },
      resolve: ({ state, inv, api }) => {
        // 卡面：「每场游戏最多一次成功」——场景级（整队）标记，控制权转移后也不会再成功。
        state.scenarioFlags ||= {}
        if (state.scenarioFlags.relicOfAgesDoomSucceeded) {
          api.info('本场游戏已经成功使用过一次「古代遗物」。')
          return
        }
        const picked = api.choice({
          kind: 'skill', source: '04303', seat: inv.seat,
          prompt: '选择意志还是智识检定。',
          options: [{ id: 'willpower', label: '意志(4)' }, { id: 'intellect', label: '智识(4)' }],
        })
        const skill = picked === 'intellect' ? 'intellect' : 'willpower'
        api.startTest({
          seat: inv.seat, skill, difficulty: 4,
          resolve: result => {
            if (!result.success) return
            const options = []
            if ((state.doom || 0) > 0) options.push({ id: 'agenda', label: `当前密谋（${state.doom}）` })
            for (const location of state.locations) {
              if ((location.doom || 0) > 0) options.push({ id: `location:${location.id}`, label: `${location.name}（${location.doom}）` })
            }
            for (const enemy of state.enemies) {
              if ((enemy.doom || 0) > 0) options.push({ id: `enemy:${enemy.id}`, label: `${enemy.name}（${enemy.doom}）` })
            }
            for (const owner of state.investigators) {
              for (const asset of owner.assets || []) {
                if ((asset.doom || 0) > 0) options.push({ id: `asset:${asset.id}`, label: `${api.cardName(asset.code)}（${asset.doom}）` })
              }
            }
            if (!options.length) { api.info('场上没有带毁灭标记的卡牌。'); return }
            const chosen = options.length === 1 ? options[0].id : api.choice({
              kind: 'target', source: '04303', seat: inv.seat,
              prompt: '选择要移除 1 个毁灭标记的卡牌。', options,
            })
            const id = String(chosen)
            if (id === 'agenda') api.removeDoom(1)
            else if (id.startsWith('location:')) {
              const location = state.locations.find(item => item.id === id.slice(9))
              if (location) api.removeDoomFromCard(location, 1)
            } else if (id.startsWith('enemy:')) {
              const enemy = state.enemies.find(item => item.id === id.slice(6))
              if (enemy) api.removeDoomFromCard(enemy, 1)
            } else if (id.startsWith('asset:')) {
              const asset = state.investigators.flatMap(owner => owner.assets || [])
                .find(item => item.id === id.slice(6))
              if (asset) api.removeDoomFromCard(asset, 1)
            }
            state.scenarioFlags ||= {}
            state.scenarioFlags.relicOfAgesDoomSucceeded = true
            api.info('🏺 古代遗物：移除了 1 个毁灭标记。')
          },
        })
      },
    },
  ],
  modifiers: [],
}
