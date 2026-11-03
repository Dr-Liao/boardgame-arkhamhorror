// 吉尔曼旅社：两个治疗点可以分别用于伤害或恐惧。
export default {
  code: '07064', scope: 'location', implemented: true,
  abilities: [{
    kind: 'action', actionKind: 'activate', label: '吉尔曼旅社：治愈2点伤害或恐惧',
    cost: { action: 1 }, limit: { scope: 'perGame', owner: 'player' },
    criteria: [({ inv }) => inv.damage > 0 || inv.horror > 0],
    resolve: ({ inv, api }) => {
      for (let point = 0; point < 2; point++) {
        const options = []
        if (inv.damage > 0) options.push({ id: 'damage', label: '治愈1点伤害' })
        if (inv.horror > 0) options.push({ id: 'horror', label: '治愈1点恐惧' })
        if (!options.length) break
        const chosen = options.length === 1 ? options[0].id : api.choice({
          kind: 'effect', seat: inv.seat, source: '07064',
          prompt: `吉尔曼旅社：分配第${point + 1}点治疗。`, options,
        })
        if (chosen === 'damage') api.healDamage(inv.seat, 1)
        else if (chosen === 'horror') api.healHorror(inv.seat, 1)
      }
    },
  }],
}
