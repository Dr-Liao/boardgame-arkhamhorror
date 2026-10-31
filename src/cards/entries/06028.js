// 06028 群星正确之时
// 卡面：绑定(仰望星空)。
//       显现 - 将群星正确之时从游戏中移除。选择一位调查员。该调查员抽取1张卡牌，获得1资源，
//       并可以立即进行一个行动，如同是自己回合(该行动不计入其每回合可以进行的行动数)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06028 群星正确之时（显式简化）：
//   · 绑定关系来自 cards-data（bondedTo: Stargazing / bondedCount: 1），由 api.bonded.group 可读；
//   · 「显现」数据体写成 played 描述子：选择一位调查员 → 该调查员抽 1 张、获得 1 资源 → exileAfterPlay
//     把本卡移出游戏。显式简化：作为「遭遇卡」被抽出时的结算路径（drawEncounter 的玩家卡分支）与
//     「立即进行一个行动」均未接线——前者见 primitive-requests/w-m2-1-06028-*，后者引擎无「回合外的
//     立即行动」原语。

export default {
  code: '06028',
  // 「将群星正确之时从游戏中移除」：事件结算后移出游戏（doPlay 收尾段的条目级去向字段）。
  removeAfterPlay: true,
  simplified: true,
  note: '未实现：作为遭遇卡被抽出时的显现结算（drawEncounter 无玩家卡分支）与「立即进行一个行动」；'
    + '已实现显现数据体（选择调查员→抽 1/获得 1→移出游戏）与绑定关系。',
  abilities: [
    {
      kind: 'played',
      label: '显现：选择一位调查员，其抽 1 张牌、获得 1 资源；将本卡移出游戏',
      resolve: ({ state, inv, api }) => {
        const candidates = (state.investigators || []).filter(target => !target.defeated && !target.resigned)
        if (!candidates.length) return
        const seatId = candidates.length === 1 ? String(candidates[0].seat) : api.choice({
          kind: 'investigator', source: '06028', seat: inv.seat,
          prompt: '选择一位调查员：其抽取 1 张牌并获得 1 资源。',
          options: candidates.map(target => ({ id: String(target.seat), label: target.name })),
        })
        const target = state.investigators[Number(seatId)]
        if (!target) return
        if ((target.deck || []).length || (target.discard || []).length) api.drawCards(target.seat, 1)
        api.gainResources(target.seat, 1)
        api.info(`「群星正确之时」：${target.name} 抽取 1 张牌、获得 1 资源；本卡移出游戏。`)
      },
    },
  ],
  modifiers: [],
}
