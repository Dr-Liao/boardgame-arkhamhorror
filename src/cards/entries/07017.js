// 07017 《圣经·诗篇》
// 卡面：使用(4秘密)。
// 卡面：[action]花费1秘密：治愈你所在地点一位调查员1点恐惧。在混乱袋中加入2个[bless]标记。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 07017 《圣经·诗篇》：使用(4秘密)；[行动]花 1 秘密治愈同地点 1 点恐惧，并加入 2 个 [bless]。

export default {
  code: '07017',
  uses: 4,
  usesType: 'secrets',
  abilities: [
    {
      kind: 'action', label: '花 1 秘密：治愈同地点 1 点恐惧并加入 2 个 [bless]',
      cost: { uses: 1 },
      resolve: ({ state, inv, api }) => {
        const candidates = api.investigatorsAt(inv.location).filter(other => other.horror > 0 || other.assets.some(asset => (asset.horror || 0) > 0))
        if (candidates.length) {
          const answer = candidates.length === 1 ? candidates[0].seat
            : api.choice({ kind: 'target', source: '07017', seat: inv.seat, prompt: '选择治愈目标。',
              options: candidates.map(other => ({ id: String(other.seat), label: other.name })) })
          const target = candidates.find(other => String(other.seat) === String(answer))
          if (target) {
            if (target.horror > 0) api.healHorror(target.seat, 1)
            else {
              const ally = target.assets.find(asset => (asset.horror || 0) > 0)
              if (ally) ally.horror -= 1
            }
            api.info(`✨ ${target.name} 的恐惧被治愈。`)
          }
        } else {
          api.info('同地点没有需要治愈的调查员或盟友。')
        }
        api.addChaosToken('bless')
        api.addChaosToken('bless')
        void state
      },
    },
  ],
  modifiers: [

  ],
}
