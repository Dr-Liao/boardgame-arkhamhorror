// 02018 团队合作
// 卡面：你所在地点的调查员彼此之间可以给出或交易任意数量的[[道具]]支援、[[盟友]]支援或资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const TRADE_TRAITS = ['item', 'ally']

export default {
  code: '02018',
  abilities: [
    {
      kind: 'played', label: '团队合作',
      resolve: ({ state, inv, api }) => {
        const participants = state.investigators.filter(other =>
          !other.defeated && !other.resigned && other.location === inv.location)
        if (participants.length < 2) return
        const tradable = owner => owner.assets.filter(item =>
          api.cardTraits(item.code).some(trait => TRADE_TRAITS.includes(String(trait).toLowerCase())))
        let giver = inv
        let first = true
        for (let guard = 0; guard < 20; guard++) {
          if (!first) {
            // 「彼此之间」：任何一位同地点调查员都可以成为给出方（支持反向/多边交易）。
            const givers = participants.filter(owner => owner.resources > 0 || tradable(owner).length)
            if (!givers.length) return
            const picked = givers.length === 1 ? givers[0] : givers.find(owner => String(owner.seat) === api.choice({
              kind: 'target', source: '02018', seat: inv.seat, prompt: '选择给出资源或支援的调查员。',
              options: [...givers.map(owner => ({ id: String(owner.seat), label: owner.name })),
                { id: 'done', label: '结束交易' }],
            }))
            if (!picked) return
            giver = picked
          }
          const receivers = participants.filter(owner => owner.seat !== giver.seat)
          const target = receivers.length === 1 ? receivers[0] : receivers.find(owner => String(owner.seat) === api.choice({
            kind: 'target', source: '02018', seat: inv.seat, prompt: '选择接受资源或支援的调查员。',
            options: receivers.map(owner => ({ id: String(owner.seat), label: owner.name })),
          }))
          if (!target) return
          const options = []
          if (giver.resources > 0) options.push({ id: 'resource', label: '资源 1 点' })
          for (const asset of tradable(giver)) options.push({ id: asset.id, label: api.cardName(asset.code) })
          if (!options.length) return
          const answer = api.choice({ kind: 'target', source: '02018', seat: inv.seat,
            prompt: '选择要给出的内容（可重复交易任意数量）。',
            options: [...options, { id: 'done', label: '结束交易' }] })
          if (answer === 'done' || !answer) return
          if (answer === 'resource') {
            api.loseResources(giver.seat, 1)
            api.gainResources(target.seat, 1)
          } else {
            const asset = giver.assets.find(item => item.id === answer)
            if (!asset) return
            api.giveAsset(asset, target.seat)
          }
          first = false
          const again = api.choice({ kind: 'target', source: '02018', seat: inv.seat,
            prompt: '是否继续交易？',
            options: [{ id: 'done', label: '结束交易' }, { id: 'more', label: '继续交易' }] })
          if (again !== 'more') return
        }
      },
    },
  ],
  modifiers: [

  ],
}
