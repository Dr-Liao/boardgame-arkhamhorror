// 08057 黑色扇子（The Black Fan）· 游荡者（Rogue）资产 · 3 经验 · 卓越 · 手部。
//
// 卡面：卓越。
//       你拥有……时：
//       - 10+ 资源：你得到 +1 生命和 +1 神智。
//       - 15+ 资源：在你回合期间，你可以额外执行一次行动。
//       - 20+ 资源：你得到每项技能值 +1。
//
// 一卡一文件：这张卡的行为只在这里维护。
// 读点：
//   · 生命/神智/技能用 modifiers 的 resourcesAtLeast 条件（statPipeline 统一读点）；
//   · 「15+ 资源：本回合额外一次行动」用 free 能力（每回合一次）+ api.gainAction 落实——
//     引擎没有「条件性常驻 extraAction」的读点；free 触发需在自己回合，等价于本回合多一次行动。
export default {
  code: '08057',
  // approximation: 引擎 getMaxHealth/getMaxSanity 不读 modifiers，因此「10+ 资源 +1 生命/神智」
  // 用被动数据通道常驻实现（资源条件在引擎接线前无法读取）。
  passive: { healthBonus: 1, sanityBonus: 1 },
  abilities: [
    {
      kind: 'free',
      label: '15+ 资源：本回合额外执行一次行动（每回合一次）',
      limit: { scope: 'perTurn', owner: 'player' },
      criteria: [
        ({ state, inv }) => state.currentSeat === inv.seat && (inv.resources || 0) >= 15,
      ],
      resolve: ({ inv, api }) => {
        api.gainAction(inv.seat, 1)
        api.info(`🪭 「黑色扇子」：${inv.name} 本回合额外执行一次行动。`)
      },
    },
  ],
  modifiers: [
    { target: 'skill:*', amount: 1, condition: { resourcesAtLeast: 20 } },
  ],
}
