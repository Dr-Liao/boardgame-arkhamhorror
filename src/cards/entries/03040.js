// 03040 头脑发热
// 卡面：显现 - 抽取遭遇牌库顶1张卡牌。该卡牌获得涌动。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03040 头脑发热：基础弱点，显现时再抽取并结算 2 张遭遇卡（原 overzealous）。

export default {
  code: '03040',
  abilities: [
    {
      kind: 'weakness', label: '再抽取并结算 2 张遭遇卡',
      weakness: { type: 'drawEncounter', amount: 2 },
      resolve: ({ inv, api }) => {
        api.drawEncounter(inv.seat)
        api.drawEncounter(inv.seat)
      },
    },
  ],
  modifiers: [

  ],
}
