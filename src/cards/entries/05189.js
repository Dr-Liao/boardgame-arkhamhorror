// 05189 秘密卷轴（神秘学家 · 3 经验）
// 卡面：使用(4秘密)。
// 卡面：[action]横置秘密卷轴并花费1秘密：查看任意一位调查员的牌库顶或牌库底1张卡牌，或遭遇牌库顶
//       或牌库底1张卡牌。然后，弃掉该卡牌、将其加入其所有者手牌，或将其放到该牌库底或者牌库顶。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05189 秘密卷轴（神秘学家）：[行动]花 1 秘密并横置：看任意牌库的顶或底 1 张，然后弃/拿/放顶/放底。
//
// 实现备注：牌库底没有通用原语（lookAt 只支持顶），这里用单卡 resolve 的窄口径直接读写牌库数组；
// 选择全部走 requestChoice，顺序确定，因此可重放。

const aliveInvestigators = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)

function zoneOptions(state) {
  const zones = aliveInvestigators(state).map(owner => ({
    id: `seat:${owner.seat}`, kind: 'investigator', seat: owner.seat,
    label: `${owner.name} 的牌库`, pile: owner.deck,
  }))
  zones.push({ id: 'encounter', kind: 'encounter', seat: null, label: '遭遇牌库', pile: state.encounterDeck })
  return zones.filter(zone => Array.isArray(zone.pile) && zone.pile.length)
}

const discardPileOf = (state, zone) =>
  zone.kind === 'encounter' ? state.encounterDiscard : state.investigators[zone.seat].discard

export default {
  code: '05189',
  uses: 4,
  usesType: 'secrets',
  abilities: [
    {
      kind: 'action',
      label: '横置并花 1 秘密：查看任意牌库顶或底 1 张，然后弃/拿/放顶/放底',
      cost: { exhaust: true, uses: 1 },
      resolve: ({ state, inv, api }) => {
        const zones = zoneOptions(state)
        if (!zones.length) { api.info('没有可以查看的牌库。'); return }
        const zoneId = zones.length === 1 ? zones[0].id : api.choice({
          kind: 'deck', source: '05189', seat: inv.seat,
          prompt: '选择要查看的牌库。', options: zones.map(zone => ({ id: zone.id, label: zone.label })),
        })
        const zone = zones.find(item => item.id === zoneId) || zones[0]
        const single = zone.pile.length === 1
        const end = single ? 'top' : api.choice({
          kind: 'effect', source: '05189', seat: inv.seat,
          prompt: '查看该牌库的哪一端？',
          options: [{ id: 'top', label: '牌库顶' }, { id: 'bottom', label: '牌库底' }],
        })
        const code = end === 'bottom' ? zone.pile[0] : zone.pile[zone.pile.length - 1]
        if (code == null) { api.info('所选牌库是空的。'); return }
        api.info(`👁 ${inv.name} 查看「${zone.label}」${end === 'bottom' ? '底' : '顶'}的「${api.cardName(code)}」。`)
        const destinations = [
          { id: 'discard', label: '弃掉该卡牌' },
          ...(zone.kind === 'investigator' ? [{ id: 'hand', label: '加入其所有者手牌' }] : []),
          { id: 'bottom', label: '放到该牌库底' },
          { id: 'top', label: '放到该牌库顶' },
        ]
        const destination = api.choice({
          kind: 'effect', source: '05189', seat: inv.seat,
          prompt: '选择该卡牌的去向。', options: destinations,
        })
        // 从牌库里摘下这张牌：顶牌用 lastIndexOf，底牌用 indexOf（同名卡不会误摘别的副本）。
        const remove = () => {
          const index = end === 'bottom' ? zone.pile.indexOf(code) : zone.pile.lastIndexOf(code)
          if (index >= 0) zone.pile.splice(index, 1)
        }
        switch (destination) {
          case 'discard':
            remove()
            discardPileOf(state, zone).push(code)
            api.info(`🃏 「${api.cardName(code)}」被弃掉。`)
            break
          case 'hand':
            remove()
            state.investigators[zone.seat].hand.push(code)
            api.info(`✋ 「${api.cardName(code)}」加入 ${state.investigators[zone.seat].name} 的手牌。`)
            break
          case 'bottom':
            remove()
            zone.pile.unshift(code)
            api.info(`📚 「${api.cardName(code)}」放到「${zone.label}」底。`)
            break
          default:
            remove()
            zone.pile.push(code)
            api.info(`📚 「${api.cardName(code)}」放到「${zone.label}」顶。`)
            break
        }
      },
    },
  ],
}
