// 02148 团结一致
// 卡面：选择你所在地点的另一位调查员。你和该调查员都抽取2张卡牌并获得2资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02148',
  abilities: [
    {
      kind: 'played', label: '团结一致',
      resolve: ({ state, inv, api }) => {
        const targets = state.investigators.filter(other =>
          !other.defeated && !other.resigned && other.seat !== inv.seat && other.location === inv.location)
        if (!targets.length) return
        const target = targets.length === 1 ? targets[0] : targets.find(other => other.seat === Number(api.choice({
          kind: 'target', source: 'standTogether', seat: inv.seat, prompt: '选择与你共享卡牌与资源的调查员。',
          options: targets.map(other => ({ id: String(other.seat), label: other.name })),
        })))
        if (!target) return
        for (const owner of [inv, target]) {
          api.gainResources(owner.seat, 2)
          api.drawCardsLogged(owner.seat, 2)
        }
      },
    },
  ],
  modifiers: [

  ],
}
