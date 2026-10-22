// 04233 收获日
// 卡面：你本回合每执行一个行动(包括本行动)，获得1资源。如果现在是你的回合，结束你的回合。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04233 收获日：本回合每个行动换 1 资源，然后结束回合。

export default {
  code: '04233',
  abilities: [
    {
      kind: 'played', label: '本回合每个行动换 1 资源并结束回合',
      resolve: ({ state, inv, api }) => {
        const amount = Math.max(1, inv.actionsTakenThisTurn || 1)
        api.gainResources(inv.seat, amount)
        api.info(`${inv.name} 获得 ${amount} 资源（本回合已执行 ${amount} 个行动）。`)
        if (state.currentSeat === inv.seat) api.endTurn(inv.seat)
      },
    },
  ],
  modifiers: [

  ],
}
