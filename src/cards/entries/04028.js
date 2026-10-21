// 04028 “交给你了！”
// 卡面：快速。在你抽取了一张非险境遭遇卡牌后，结算该卡牌效果前打出。
// 卡面：选择另一位调查员。改为视为该调查员抽取了该遭遇卡牌。获得1资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04028 你来处理：自己的遭遇卡改由别人接手，并获得 1 资源。

export default {
  code: '04028',
  abilities: [
    {
      kind: 'played', fast: true, trigger: 'encounterDrawn',
      criteria: { nonPerilOnly: true, selfOnly: true },
      label: '你来处理',
      resolve: ({ state, inv, api }) => {
        const others = api.investigatorsAt(inv.location).filter(other => other.seat !== inv.seat)
        const everyone = state.investigators.filter(other => !other.defeated && !other.resigned && other.seat !== inv.seat)
        const candidates = others.length ? others : everyone
        if (!candidates.length) { api.info('没有其他调查员可以接手这张遭遇卡。'); return }
        const chosen = candidates.length === 1 ? String(candidates[0].seat)
          : api.choice({ kind: 'target', source: '04028', seat: inv.seat,
            prompt: '选择接手这张遭遇卡的调查员。',
            options: candidates.map(other => ({ id: String(other.seat), label: other.name })) })
        const target = candidates.find(other => String(other.seat) === chosen) || candidates[0]
        api.redirectEncounterTo(target.seat)
        api.gainResources(inv.seat, 1)
        api.info(`${inv.name} 打出「${api.cardName('04028')}」：改由 ${target.name} 结算这张遭遇卡，并获得 1 资源。`)
      },
    },
  ],
  modifiers: [

  ],
}
