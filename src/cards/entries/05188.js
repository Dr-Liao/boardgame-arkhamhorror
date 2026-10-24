// 05188 秘密卷轴（探求者 · 3 经验）
// 卡面：使用(3秘密)。
// 卡面：[action]横置秘密卷轴并花费1秘密：查看任意一位调查员的牌库底或遭遇牌库底3张卡牌。
//       你可以弃掉其中1张。你可以将其中1张加入其所有者手牌。
//       将其中剩余的卡牌以任意顺序放到该牌库顶或牌库底。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05188 秘密卷轴（探求者）：[行动]花 1 秘密并横置：看任意牌库底 3 张，可弃 1、可拿 1，其余放顶或底。
//
// 实现备注：引擎的 lookAt 只支持牌库顶；牌库底没有通用原语，这里用单卡 resolve 的窄口径
// 直接读写牌库数组（顺序确定、随机性为零、选择全部走 requestChoice，因此可重放）。
// 遭遇牌库没有「所有者手牌」，按规则该分支不提供「加入手牌」选项。

const aliveInvestigators = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)

function zoneOptions(state) {
  const zones = aliveInvestigators(state).map(owner => ({
    id: `seat:${owner.seat}`, kind: 'investigator', seat: owner.seat,
    label: `${owner.name} 的牌库`, pile: owner.deck,
  }))
  zones.push({ id: 'encounter', kind: 'encounter', seat: null, label: '遭遇牌库', pile: state.encounterDeck })
  return zones.filter(zone => Array.isArray(zone.pile) && zone.pile.length)
}

export default {
  code: '05188',
  uses: 3,
  usesType: 'secrets',
  abilities: [
    {
      kind: 'action',
      label: '横置并花 1 秘密：查看任意牌库底 3 张，可弃 1、可拿 1，其余放顶或底',
      cost: { exhaust: true, uses: 1 },
      resolve: ({ state, inv, api }) => {
        const zones = zoneOptions(state)
        if (!zones.length) { api.info('没有可以查看的牌库。'); return }
        const zoneId = zones.length === 1 ? zones[0].id : api.choice({
          kind: 'deck', source: '05188', seat: inv.seat,
          prompt: '选择要查看牌库底 3 张的牌库。', options: zones.map(zone => ({ id: zone.id, label: zone.label })),
        })
        const zone = zones.find(item => item.id === zoneId) || zones[0]
        const count = Math.min(3, zone.pile.length)
        const looked = zone.pile.slice(0, count) // 牌库底在上：数组第 0 位是牌库底
        if (!looked.length) { api.info('所选牌库是空的。'); return }
        // 先把看过的牌从牌库底摘出来，之后按玩家选择放回/拿走。
        for (const code of looked) {
          const index = zone.pile.indexOf(code)
          if (index >= 0) zone.pile.splice(index, 1)
        }
        api.info(`👁 ${inv.name} 查看「${zone.label}」底部的 ${looked.length} 张：` +
          looked.map(code => api.cardName(code)).join('、'))

        const remaining = [...looked]
        const pickOne = (prompt) => {
          if (!remaining.length) return null
          const options = [{ id: 'skip', label: '不选' },
            ...remaining.map((code, index) => ({ id: String(index), cardCode: code, label: api.cardName(code) }))]
          const answer = api.choice({ kind: 'card', source: '05188', seat: inv.seat, canSkip: true, prompt, options })
          if (answer === 'skip') return null
          const code = remaining[Number(answer)]
          if (code == null) return null
          remaining.splice(remaining.indexOf(code), 1)
          return code
        }

        // 1) 可以弃掉其中 1 张。
        const discarded = pickOne('你可以弃掉其中 1 张卡牌。')
        if (discarded != null) {
          if (zone.kind === 'encounter') state.encounterDiscard.push(discarded)
          else state.investigators[zone.seat].discard.push(discarded)
          api.info(`🃏 弃掉「${api.cardName(discarded)}」。`)
        }
        // 2) 可以将其中的 1 张加入其所有者手牌（遭遇牌库没有所有者，不提供该选项）。
        if (zone.kind === 'investigator') {
          const toHand = pickOne('你可以将其中 1 张加入该调查员的手牌。')
          if (toHand != null) {
            state.investigators[zone.seat].hand.push(toHand)
            api.info(`✋ 「${api.cardName(toHand)}」加入 ${state.investigators[zone.seat].name} 的手牌。`)
          }
        }
        // 3) 其余以任意顺序放到牌库顶或牌库底（这里保持原相对顺序）。
        if (remaining.length) {
          const where = api.choice({
            kind: 'effect', source: '05188', seat: inv.seat,
            prompt: '将其余的卡牌放到该牌库的哪一端？',
            options: [{ id: 'top', label: '牌库顶' }, { id: 'bottom', label: '牌库底' }],
          })
          if (where === 'bottom') zone.pile.unshift(...remaining)
          else zone.pile.push(...remaining)
          api.info(`📚 其余 ${remaining.length} 张放回「${zone.label}」${where === 'bottom' ? '底' : '顶'}。`)
        }
      },
    },
  ],
}
