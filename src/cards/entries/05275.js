// 05275 恐怖揭露
// 卡面：发现你所在地点的3个线索。将你任意数量的线索交给另一位调查员，或者在任意一个地点上放置你任意数量的线索。
// 卡面：你被击败并承受1点精神创伤。本行动不会触发趁乱攻击。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05275 恐怖揭露：发现 3 线索 → 可把任意数量线索交给别人或放到任意地点 → 自我击败并受 1 点精神创伤。
// 线索转移用调查员实例的 clues 字段（引擎在 applyMove 收尾统一 syncClues），自我击败走通用 api.lethalSelfDamage
// （与「同归于尽」等自我击败卡同一读点）。

export default {
  code: '05275',
  abilities: [
    {
      kind: 'played',
      noOpportunityAttack: true,
      label: '发现 3 线索，交出/放置线索，然后被击败',
      resolve: ({ state, inv, api }) => {
        api.discoverClue(inv.seat, 3)
        const others = state.investigators.filter(other => other.seat !== inv.seat && !other.defeated && !other.resigned)
        if (inv.clues > 0) {
          const options = [{ id: 'done', label: '保留线索' }]
          if (others.length) options.push({ id: 'give', label: '把线索交给另一位调查员' })
          options.push({ id: 'place', label: '把线索放置在任意一个地点' })
          const action = api.choice({ kind: 'effect', source: '05275', seat: inv.seat,
            prompt: '线索处理：把任意数量的线索交给别人、放到任意地点，或全部保留。', options })
          if (action === 'give' && others.length) {
            const who = others.length === 1 ? String(others[0].seat) : api.choice({ kind: 'target', source: '05275', seat: inv.seat,
              prompt: '选择要接收线索的调查员。', options: others.map(other => ({ id: String(other.seat), label: other.name })) })
            const target = state.investigators[Number(who)] || others[0]
            const amount = api.choice({ kind: 'resource', source: '05275', seat: inv.seat, prompt: '交出多少个线索？',
              options: Array.from({ length: inv.clues }, (_, index) => ({ id: String(index + 1), label: `${index + 1} 个线索` })) })
            const n = Math.min(inv.clues, Math.max(1, Number(amount) || 1))
            inv.clues -= n
            target.clues += n
            api.info(`${inv.name} 把 ${n} 个线索交给 ${target.name}。`)
          } else if (action === 'place') {
            const locationId = api.choice({ kind: 'target', source: '05275', seat: inv.seat, prompt: '选择放置线索的地点。',
              options: state.locations.map(location => ({ id: location.id, label: location.name || location.id })) })
            const location = state.locations.find(item => item.id === locationId) || state.locations[0]
            if (location) {
              const amount = api.choice({ kind: 'resource', source: '05275', seat: inv.seat, prompt: '放置多少个线索？',
                options: Array.from({ length: inv.clues }, (_, index) => ({ id: String(index + 1), label: `${index + 1} 个线索` })) })
              const n = Math.min(inv.clues, Math.max(1, Number(amount) || 1))
              inv.clues -= n
              location.clues = (location.clues || 0) + n
              api.info(`${inv.name} 把 ${n} 个线索放置在「${location.name || location.id}」。`)
            }
          }
        }
        if (!inv.defeated && !inv.resigned) {
          api.lethalSelfDamage(inv.seat)
          api.addTrauma(inv.seat, 'mental', 1)
          api.info(`${inv.name} 被「恐怖揭露」击败，承受 1 点精神创伤。`)
        }
      },
    },
  ],
  modifiers: [

  ],
}
