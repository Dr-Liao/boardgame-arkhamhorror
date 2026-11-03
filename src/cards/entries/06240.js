// 06240 虎口拔牙
// 卡面：你将虎口拔牙投入到一次技能检定后，从你牌库顶揭示卡牌，直到揭示一张能够投入本次检定的
//       [rogue]技能卡牌。将其投入。将其他每张已揭示的卡牌混洗回你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 投入后由技能 onCommit 从牌库顶揭示并投入一张符合条件的流浪者技能牌。

export default {
  code: '06240',
  abilities: [
    {
      kind: 'commit',
      label: '虎口拔牙',
      skill: {
        onCommit: ({ inv, api }) => {
          const found = api.revealAndCommitSkill(inv.seat, { class: 'rogue' })
          if (found) api.info(`${inv.name} 用「虎口拔牙」揭示并投入「${api.cardName(found)}」。`)
        },
      },
    },
  ],
  modifiers: [],
}
