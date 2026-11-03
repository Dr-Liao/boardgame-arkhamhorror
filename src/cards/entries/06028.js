// 06028 群星正确之时
// 卡面：绑定(仰望星空)。
//       显现 - 将群星正确之时从游戏中移除。选择一位调查员。该调查员抽取1张卡牌，获得1资源，
//       并可以立即进行一个行动，如同是自己回合(该行动不计入其每回合可以进行的行动数)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 遭遇牌库抽出后经 encounterResolve 结算，并由引擎移出游戏。
// 「可以立即进行一个行动」由 api.beginImmediateAction 在显现结算中同步执行，随后恢复原阶段与行动池。

const revealStars = ({ state, inv, api }) => {
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
  const answer = api.choice({
    kind: 'action', source: '06028', seat: target.seat,
    prompt: `${target.name} 可以立即进行一次行动，如同现在是自己的回合。`,
    options: [
      { id: 'act', label: '立即进行一次行动' },
      { id: 'skip', label: '不进行行动' },
    ],
  })
  if (answer === 'act') api.beginImmediateAction(target.seat, { source: '06028' })
  api.info(`「群星正确之时」：${target.name} 抽取 1 张牌、获得 1 资源；本卡移出游戏。`)
}

export default {
  code: '06028',
  // 「将群星正确之时从游戏中移除」：事件结算后移出游戏（doPlay 收尾段的条目级去向字段）。
  removeAfterPlay: true,
  encounterResolve: (state, inv, _card, api) => revealStars({ state, inv, api }),
  abilities: [
    {
      kind: 'played',
      label: '显现：选择一位调查员，其抽 1 张牌、获得 1 资源；将本卡移出游戏',
      resolve: revealStars,
    },
  ],
  modifiers: [],
}
