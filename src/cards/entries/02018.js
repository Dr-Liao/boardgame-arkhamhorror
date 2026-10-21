// 02018 团队合作
// 卡面：你所在地点的调查员彼此之间可以给出或交易任意数量的[[道具]]支援、[[盟友]]支援或资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02018',
  abilities: [
    {
      kind: 'played', label: '团队合作',
      resolve: ({ state, inv, api }) => {
        const others = state.investigators.filter(other =>
          !other.defeated && !other.resigned && other.seat !== inv.seat && other.location === inv.location)
        if (!others.length) return
        const targetSeat = others.length === 1 ? String(others[0].seat) : api.choice({
          kind: 'target', source: '02018', seat: inv.seat, prompt: '选择交换物品、盟友或资源的调查员。',
          options: others.map(other => ({ id: String(other.seat), label: other.name })),
        })
        const target = others.find(other => String(other.seat) === targetSeat)
        if (!target) return
        const options = []
        if (inv.resources) options.push({ id: 'resource', label: '交给对方 1 资源' })
        for (const asset of inv.assets.filter(item =>
          api.cardTraits(item.code).some(trait => ['item', 'ally'].includes(trait))))
          options.push({ id: asset.id, label: `交给对方：${api.cardName(asset.code)}` })
        if (!options.length) return
        const answer = api.choice({ kind: 'target', source: '02018', seat: inv.seat, prompt: '选择要交换的内容。', options })
        if (answer === 'resource') {
          api.loseResources(inv.seat, 1)
          api.gainResources(target.seat, 1)
          return
        }
        const asset = inv.assets.find(item => item.id === answer)
        if (asset) api.giveAsset(asset, target.seat)
      },
    },
  ],
  modifiers: [

  ],
}
