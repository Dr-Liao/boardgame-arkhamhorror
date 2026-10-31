// 06158 异界手稿
// 卡面：使用(3秘密)。
// 卡面：[action]横置异界手稿并花费1秘密：查找遭遇牌库顶的9张卡牌，并从中选择一张非[[精英]]卡牌。
//       弃掉场上一张与该所选卡牌同名的卡牌。将查找的所有卡牌混洗回遭遇牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 遭遇牌库顶 9 张以只读方式取（state.encounterDeck 尾部，顶在数组末位；精英标记读 state.cards[code].elite）；
//   · 混洗回遭遇牌库走 api.lookAt（zone:'encounterDeck'、returnStrategy:'shuffle'，唯一洗回入口）；
//   · 弃掉场上的同名卡：遭遇敌人用 api.removeEnemy，场上的诡计附属用 api.cardsInPlayTreacheries + api.discardCardInPlay。

export default {
  code: '06158',
  uses: 3,
  usesType: 'secret',
  discardWhenEmpty: true,
  abilities: [
    {
      kind: 'action',
      label: '横置并花 1 秘密：查找遭遇牌库顶 9 张，弃掉场上一张同名非[[精英]]卡，然后洗回',
      cost: { action: true, exhaust: true, uses: 1 },
      resolve: ({ state, inv, api, source }) => {
        const deck = state.encounterDeck || []
        const count = Math.min(9, deck.length)
        if (!count) { api.info('遭遇牌库是空的，无法查找。'); return }
        const searched = deck.slice(-count).reverse()
        const defOf = code => state.cards?.[code] || null
        const candidates = searched.filter(code => defOf(code)?.elite !== true)
        api.info(`👁 查找遭遇牌库顶 ${count} 张：${searched.map(code => api.cardName(code)).join('、')}。`)
        // 查找的牌整体混洗回遭遇牌库（只混洗、不移动：素材本来就在牌库里）。
        api.lookAt(inv.seat, {
          zone: 'encounterDeck', count, choose: 0, arrange: false,
          returnStrategy: 'shuffle', source: '06158',
        })
        if (!candidates.length) { api.info('其中没有非[[精英]]卡牌；所有查找的卡牌已混洗回遭遇牌库。'); return }
        const unique = [...new Set(candidates)]
        const answer = unique.length === 1 ? unique[0] : api.choice({
          kind: 'card', source: '06158', seat: inv.seat,
          prompt: '选择一张非[[精英]]卡牌（将弃掉场上一张同名卡）。',
          options: unique.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
        })
        const chosen = unique.includes(String(answer)) ? String(answer) : unique[0]
        let discarded = 0
        // 场上的遭遇敌人：移出游戏（弃掉）。
        for (const foe of [...(state.enemies || [])]) {
          if (foe.code !== chosen && foe.originalCode !== chosen) continue
          api.removeEnemy(foe)
          api.info(`🗑️ 场上的「${api.cardName(chosen)}」被弃掉。`)
          discarded += 1
          break
        }
        // 场上的诡计附属（威胁区/地点/敌人附属）。
        if (!discarded) {
          const inPlay = api.cardsInPlayTreacheries().filter(entry => entry.code === chosen)
          if (inPlay.length) {
            api.discardCardInPlay(inPlay[0])
            api.info(`🗑️ 场上的「${api.cardName(chosen)}」被弃掉。`)
            discarded += 1
          }
        }
        if (!discarded) api.info(`场上没有与「${api.cardName(chosen)}」同名的卡牌；仅完成查找与混洗。`)
        if (source) api.info(`「${api.cardName('06158')}」横置并花费 1 秘密（剩余 ${source.uses ?? 0}）。`)
      },
    },
  ],
  modifiers: [],
}
