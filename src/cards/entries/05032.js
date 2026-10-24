// 05032 否决存在
// 卡面：快速。在遭遇卡牌或敌人攻击将要导致你执行以下一项(选择一项)时打出：
//       弃掉手牌、失去资源、失去行动、受到伤害、受到恐惧。你忽略该效果的影响。(所有其他效果如常结算。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05032 否决存在：harmDealt 窗口的快速事件——取消刚受到的伤害/恐惧（api.cancelHarm，
// 与 03157 吉人天相同一套通用取消原语）。
// 显式简化：卡面还可取消「弃手牌 / 失资源 / 失行动」三项，引擎没有这三类效果的通用取消读点；
// 且触发范围放宽为任意伤害/恐惧（不限于遭遇卡或敌人攻击）。

export default {
  code: '05032',
  simplified: true,
  note: '未实现：取消「弃手牌 / 失资源 / 失行动」三项（引擎缺通用取消读点）；触发范围放宽为任意伤害/恐惧来源。已实现快速打出并取消本次伤害和/或恐惧。',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'harmDealt',
      label: '否决存在：忽略本次伤害/恐惧',
      resolve: ({ inv, api }) => {
        api.cancelHarm(inv.seat, {
          maximum: 20,
          source: '05032',
          prompt: '选择「否决存在」要取消的伤害与恐惧。',
        })
      },
    },
  ],
  modifiers: [

  ],
}
