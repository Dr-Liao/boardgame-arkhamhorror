// 06020 庄严立誓
// 卡面：多重。快速。
//       打出庄严立誓，置于你所在地点的另一位调查员控制之下。
//       [fast]如果庄严立誓的所有者位于你所在地点，横置庄严立誓：
//       将你控制的卡牌上的1点伤害或恐惧移动到该调查员控制的一张卡牌上。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06020 庄严立誓：
//   · 入场：api.giveAsset(source, 另一名调查员的座位) → 控制权转移（所有者仍是打出者）。
//     所有者座位记在实例的 statOverride 里（`solemnVowOwner:<seat>`；该字段引擎只按技能名读取，
//     非技能名条目不会产生任何数值效果）；引擎没有玩家支援的通用 ownerSeat 写点。
//   · [fast]：api.moveHarm 在「你控制的卡（本人/支援）」与「该调查员控制的卡（本人/支援）」之间
//     移动 1 点伤害或恐惧；两边都必须有可移动/可承接的量。

export default {
  code: '06020',
  fast: true,
  playCondition: [
    {
      when: ({ state, inv }) => (state.investigators || []).some(other =>
        other.seat !== inv.seat && !other.defeated && !other.resigned && other.location === inv.location),
      message: '你所在地点没有其他调查员，不能打出「庄严立誓」',
    },
  ],
  abilities: [
    {
      kind: 'entersPlay',
      label: '置于你所在地点的另一位调查员控制之下',
      resolve: ({ state, inv, source, api }) => {
        const others = api.investigatorsAt(inv.location).filter(other => other.seat !== inv.seat)
        if (!others.length || !source) return
        const seatId = others.length === 1 ? String(others[0].seat) : api.choice({
          kind: 'investigator', source: '06020', seat: inv.seat,
          prompt: '选择「庄严立誓」的控制者（你所在地点的另一位调查员）。',
          options: others.map(other => ({ id: String(other.seat), label: other.name })),
        })
        const seat = Number(seatId)
        const target = state.investigators[seat]
        if (!target) return
        api.setStatOverride(source, [`solemnVowOwner:${inv.seat}`])
        if (!api.giveAsset(source, seat)) return
        api.info(`「庄严立誓」置于 ${target.name} 的控制之下（所有者：${inv.name}）。`)
      },
    },
    {
      kind: 'free',
      label: '所有者在此：横置，将你控制的卡上 1 点伤害/恐惧移动到该调查员控制的卡上',
      cost: { action: false, exhaust: true },
      criteria: [({ state, inv, source }) => {
        const marker = (source?.statOverride || []).find(value => String(value).startsWith('solemnVowOwner:'))
        if (!marker) return false
        const owner = state.investigators[Number(String(marker).split(':')[1])]
        if (!owner || owner.defeated || owner.resigned || owner.location !== inv.location) return false
        // 自己控制的卡上必须至少有 1 点伤害/恐惧（承接方的容量在 resolve 里用 api.harmRoomOf 过滤）。
        return (inv.damage || 0) > 0 || (inv.horror || 0) > 0
          || (inv.assets || []).some(item => (item.damage || 0) > 0 || (item.horror || 0) > 0)
      }],
      resolve: ({ state, inv, source, api }) => {
        const marker = (source?.statOverride || []).find(value => String(value).startsWith('solemnVowOwner:'))
        const ownerSeat = Number(String(marker || '').split(':')[1])
        const owner = state.investigators[ownerSeat]
        if (!owner) return
        const froms = [
          { spec: { seat: inv.seat }, label: `${inv.name}（调查员）`, damage: inv.damage || 0, horror: inv.horror || 0 },
          ...(inv.assets || []).map(item => ({ spec: { seat: inv.seat, assetId: item.id }, label: api.cardName(item.code), damage: item.damage || 0, horror: item.horror || 0 })),
        ].filter(item => item.damage > 0 || item.horror > 0)
        const tos = [
          { spec: { seat: owner.seat }, label: `${owner.name}（调查员）` },
          ...(owner.assets || []).map(item => ({ spec: { seat: owner.seat, assetId: item.id }, label: api.cardName(item.code) })),
        ].filter(item => {
          const room = api.harmRoomOf(item.spec)
          return (room.damage || 0) > 0 || (room.horror || 0) > 0
        })
        if (!froms.length || !tos.length) {
          api.info('「庄严立誓」：没有可移动的伤害/恐惧或可承接的卡牌。')
          return
        }
        const from = froms.length === 1 ? froms[0] : froms[Number(api.choice({
          kind: 'target', source: '06020', seat: inv.seat,
          prompt: '选择要从哪张你控制的卡上移动 1 点伤害/恐惧。',
          options: froms.map((item, index) => ({ id: String(index), label: item.label })),
        }))]
        if (!from) return
        const to = tos.length === 1 ? tos[0] : tos[Number(api.choice({
          kind: 'target', source: '06020', seat: inv.seat,
          prompt: `选择要把 1 点${from.damage > 0 && from.horror > 0 ? '伤害/恐惧' : from.damage > 0 ? '伤害' : '恐惧'}移动到哪张卡。`,
          options: tos.map((item, index) => ({ id: String(index), label: item.label })),
        }))]
        if (!to) return
        const kinds = []
        if (from.damage > 0 && (api.harmRoomOf(to.spec).damage || 0) > 0) kinds.push('damage')
        if (from.horror > 0 && (api.harmRoomOf(to.spec).horror || 0) > 0) kinds.push('horror')
        const kind = kinds.length === 1 ? kinds[0] : api.choice({
          kind: 'effect', source: '06020', seat: inv.seat,
          prompt: '移动 1 点伤害，还是 1 点恐惧？',
          options: kinds.map(id => ({ id, label: id === 'damage' ? '1 点伤害' : '1 点恐惧' })),
        })
        const amounts = kind === 'damage' ? { damage: 1 } : { horror: 1 }
        const applied = api.moveHarm(from.spec, to.spec, amounts)
        if ((applied?.damage || 0) + (applied?.horror || 0) > 0) {
          api.info(`「庄严立誓」：从「${from.label}」移动 1 点${kind === 'damage' ? '伤害' : '恐惧'}到「${to.label}」。`)
        }
      },
    },
  ],
  modifiers: [],
}
