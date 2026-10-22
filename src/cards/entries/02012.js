// 02012 吉姆的小号
// 卡面：吉姆·卡尔弗牌库专用。
// 卡面：[reaction]在技能检定期间揭示[skull]标记时，横置吉姆的小号：治愈你所在地点或连接地点的一位调查员1点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02012 吉姆的小号：揭示骷髅标记后横置，治愈同地点 1 点恐惧。

export default {
  code: '02012',
  abilities: [
    {
      kind: 'reaction', trigger: 'skullRevealed', id: 'jimsTrumpet', legacyReaction: true,
      label: '揭示骷髅标记后治愈 1 点恐惧', cost: { exhaust: true },
      // 第 121 轮：治愈对象（本地点或连接地点、有恐惧的调查员）由条目自己选，走 ctx.api。
      resolve: ({ state, inv, api }) => {
        const connections = state.locations.find(location => location.id === inv.location)?.connections || []
        const targets = state.investigators.filter(other => !other.defeated && !other.resigned && other.horror > 0
          && (other.location === inv.location || connections.includes(other.location)))
        if (!targets.length) return
        const id = targets.length === 1 ? String(targets[0].seat) : api.choice({
          kind: 'target', source: '02012', seat: inv.seat,
          prompt: '选择本地点或连接地点的一名调查员，治疗 1 点恐惧。',
          options: targets.map(target => ({ id: String(target.seat), label: target.name })),
        })
        const target = targets.find(item => String(item.seat) === id)
        if (!target) return
        api.healHorror(target.seat, 1)
        api.info(`${target.name} 治疗 1 点恐惧。`)
      },
    },
  ],
  modifiers: [

  ],
}
