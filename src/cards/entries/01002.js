// 01002 黛西·沃克
// 卡面：你可以在自己回合期间执行额外一个行动，该行动只能用于[[书籍]]的[action]能力。
// 卡面：[elder_sign]效果：+0。如果你检定成功，你每控制一个[[书籍]]，抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 黛西·沃克：旧印 +0；可以抽取等同于你控制的[[书籍]]支援数量的牌。

const factory = () => ({ inv, api }) => ({
    delta: 0,
    optionalDraw: api.countControlled(inv.seat, { trait: 'Tome' }).length,
  })

export default {
  code: '01002',
  investigator:   {
    "elderSign": {
      "kind": "drawPerTome"
    },
    "extraTomeAction": true
  },
  kind: 'investigator',
  elderSign: { id: '01002-eldersign', resolve: factory() },
  abilities: [],
  modifiers: [],
}
