// 06003 托尼·摩尔根
// 卡面：在你回合期间，你可以进行额外一次行动，该行动只能用于与带有赏金的敌人交战，或攻击带有
//       赏金的敌人。
// 卡面：[elder_sign] 效果：+2。在赏金合约上放置 1 点赏金。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · `restrictedAction: { kind: 'bounty' }`：P6 原语（src/engine/restricted-actions.js）。
//     授权在补给阶段（phases.js），可用性/扣费在 moves.js / dispatch.js / engine.spendAction，
//     判定「交战或攻击带赏金的敌人」在 table-decisions.js 的 restrictedKindOfMove。
//   · 旧印的赏金落在「赏金合约」上（card-counters.js 的具名计数器 bounty）。

export default {
  code: '06003',
  kind: 'investigator',
  investigator: {
    restrictedAction: { kind: 'bounty' },
    elderSign: { bonus: 2 },
  },
  elderSign: {
    id: '06003-eldersign',
    label: '旧印：+2，在赏金合约上放置 1 点赏金',
    resolve: ({ inv, api }) => {
      const contracts = (inv.assets || []).find(asset => asset.code === '06010')
      if (contracts) api.addCardCounter(contracts, 'bounty', 1, { max: 6 })
      return { delta: 2 }
    },
  },
  abilities: [],
  modifiers: [],
}
