const optionsFor = (inv, canDraw, canGain, blessRoom) => [
  ...(inv.damage > 0 ? [{ id: 'heal', label: '治疗1点伤害' }] : []),
  ...(canDraw ? [{ id: 'draw', label: '抽2张卡牌' }] : []),
  ...(canGain ? [{ id: 'resources', label: '获得3个资源' }] : []),
  ...(blessRoom > 0 ? [{ id: 'bless', label: `加入${Math.min(4, blessRoom)}个祝福标记` }] : []),
]

// Printed fast action and damage healing govern; the source Haskell's action
// icon and horror-healing availability test are inconsistent with the card.
export default {
  code: '07287', scope: 'location',
  abilities: [{
    kind: 'free', actionKind: 'activate', label: '花费蓝、红、白或黄色钥匙：选择三项不同的恩赐',
    additionalKeyCost: { colors: ['blue', 'red', 'white', 'yellow'] },
    criteria: ({ inv, helpers }) => optionsFor(inv, helpers.canDrawCards(), helpers.canGainResources(), helpers.poolTokenRoom('bless')).length > 0,
    resolve: ({ state, inv, api }) => {
      const selected = new Set()
      for (let count = 0; count < 3; count++) {
        const actor = state.investigators[inv.seat]
        const options = optionsFor(actor, api.canDrawCards(inv.seat), api.canGainResources(inv.seat), api.chaosTokens.room('bless'))
          .filter(option => !selected.has(option.id))
        if (!options.length) break
        const id = options.length === 1 ? options[0].id : api.choice({ kind: 'effect', source: '07287', seat: inv.seat,
          prompt: `选择不同的恩赐（已选择${selected.size}项，共选择3项）。`, options,
        })
        if (!options.some(option => option.id === id)) break
        selected.add(id)
        if (id === 'heal') api.healDamage(inv.seat, 1)
        else if (id === 'draw') api.drawCards(inv.seat, 2)
        else if (id === 'resources') api.gainResources(inv.seat, 3)
        else api.chaosTokens.add('bless', 4)
      }
    },
  }],
}
