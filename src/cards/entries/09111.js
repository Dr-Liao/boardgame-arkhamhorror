// 09111 野兽本性（Nature of the Beast）· 幸存者事件 · 1 经验 · [[抉择]]
// 卡面：每轮最多 2 张[[抉择]]。
//       显现 - 揭示遭遇牌库顶 3 张卡牌。选择一位调查员抽取 1 张揭示的卡牌，弃掉其余卡牌。
//       然后，选择一位调查员发现任意已揭示地点的 1 个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 手牌来源强制能力 + cardDrawn 窗口（与 09106 同一「显现」实现）；
//   · 遭遇牌库只读顶 3 张：api.encounterDeckCards（数组末位是顶）；取走/弃掉走
//     api.takeEncounterDeckCard / api.discardEncounterCards；「抽 1 张」走 api.drawEncounter
//     （真实抽牌管线：会结算显现，因此先把其余两张移出，选中的那张自然成为顶牌）；
//   · 线索：api.discoverClue。
// approximation: 「每轮最多 2 张抉择」按本卡每轮 2 次近似；重复卡号按「同码任一实体」处理。
const code = '09111'

export default {
  code,
  note: 'approximation: 「每轮最多 2 张抉择」按本卡每轮 2 次近似（缺特质作用域上限）；重复卡号按同码实体处理。',
  playCondition: [{ when: () => false, message: '「野兽本性」具有显现，只能在抽到时结算' }],
  abilities: [
    {
      kind: 'forced',
      fromHand: true,
      noPlayCost: true,
      trigger: 'cardDrawn',
      limit: { scope: 'perRound', owner: 'investigator', count: 2 },
      label: '显现：揭示遭遇牌库顶 3 张，一位调查员抽 1 张、弃其余，然后一位调查员发现任意已揭示地点线索',
      criteria: [({ inv, context }) => context?.cardCode === code && (inv.hand || []).includes(code)],
      resolve: ({ state, inv, api }) => {
        const deck = api.encounterDeckCards()
        const revealed = deck.slice(-3).reverse()
        api.discardFromHand(inv.seat, code)
        if (!revealed.length) { api.info('「野兽本性」：遭遇牌库为空。'); return }
        api.info(`🐾 「野兽本性」：揭示遭遇牌库顶 ${revealed.map(code => api.cardName(code)).join('、')}。`)
        const drawnIndex = revealed.length === 1 ? 0 : Number(api.choice({
          kind: 'card', source: code, seat: inv.seat,
          prompt: '「野兽本性」：选择被抽走的那张遭遇卡。',
          options: revealed.map((cardCode, index) => ({
            id: String(index), cardCode, label: `${api.cardName(cardCode)}（第 ${index + 1} 张）`,
          })),
        }))
        const targetSeat = Number(state.investigators.filter(owner => !owner.defeated && !owner.resigned).length === 1
          ? state.investigators.find(owner => !owner.defeated && !owner.resigned).seat
          : api.choice({
            kind: 'investigator', source: code, seat: inv.seat,
            prompt: '「野兽本性」：选择抽取这 1 张遭遇卡的调查员。',
            options: state.investigators.filter(owner => !owner.defeated && !owner.resigned)
              .map(owner => ({ id: String(owner.seat), label: owner.name })),
          }))
        for (const [index, cardCode] of revealed.entries()) {
          if (index === (Number.isFinite(drawnIndex) ? drawnIndex : 0)) continue
          api.takeEncounterDeckCard(cardCode)
          api.discardEncounterCards([cardCode], { log: false })
        }
        api.info(`🃏 「野兽本性」：${api.cardName(revealed[Number.isFinite(drawnIndex) ? drawnIndex : 0])} 由调查员抽取，其余弃掉。`)
        api.drawEncounter(targetSeat)
        const owners = state.investigators.filter(owner => !owner.defeated && !owner.resigned)
        const candidates = (state.locations || []).filter(location => location.revealed && (location.clues || 0) > 0)
        if (!owners.length || !candidates.length) return
        const clueSeat = owners.length === 1 ? owners[0].seat : Number(api.choice({
          kind: 'investigator', source: code, seat: inv.seat,
          prompt: '「野兽本性」：选择发现线索的调查员。',
          options: owners.map(owner => ({ id: String(owner.seat), label: owner.name })),
        }))
        const locationId = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'location', source: code, seat: clueSeat,
          prompt: '「野兽本性」：选择发现 1 个线索的已揭示地点。',
          options: candidates.map(location => ({ id: location.id, label: api.locName(location.id) })),
        })
        if (locationId) api.discoverClue(clueSeat, 1, locationId)
      },
    },
  ],
  modifiers: [],
}
