// 09554 市议会 · 地点（sanguineShadows）
export default {
  code: '09554',
  scope: 'location',
  implemented: true,
  flags: { printedShroud: 4, printedClues: 2 },
  abilities: [{
    kind: 'free', actionKind: 'activate', range: 'here', requiresEncounterDeck: true,
    label: '查看此地一张隐匿迷你卡，然后抽取遭遇卡（可花费 2 个线索取消）',
    criteria: ({ state, inv, source }) => source.revealed && inv.location === source.id
      && state.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards?.some(card =>
        card.locationId === source.id && !card.flipped),
    resolve: ({ inv, source, api }) => {
      const cards = api.tsk.concealed.at(source.id).filter(card => !card.flipped)
      if (!cards.length) return false
      const id = cards.length === 1 ? cards[0].id : api.choose({
        kind: 'card', source: '09554', seat: inv.seat,
        prompt: '市议会：选择查看一张隐匿迷你卡。',
        options: cards.map((card, index) => ({ id: card.id, label: `隐匿迷你卡 ${index + 1}` })),
      })
      if (!cards.some(card => card.id === id)) return false
      api.tsk.concealed.markKnown(id, [inv.seat])
      api.scenario.drawEncounter(inv.seat, { mayCancel: ({ code }) => {
        if (inv.clues < 2 || !api.scenario.canSpendClues(inv.seat)) return false
        const choice = api.choose({
          kind: 'choice', source: '09554', seat: inv.seat,
          prompt: `是否花费 2 个线索取消「${api.cardName(code)}」的效果并弃掉它？`,
          options: [{ id: 'keep', label: '结算遭遇卡' }, { id: 'cancel', label: '花费 2 个线索取消' }],
        })
        if (choice !== 'cancel') return false
        api.spendClues(inv.seat, 2)
        return true
      } })
      return true
    },
  }],
}
