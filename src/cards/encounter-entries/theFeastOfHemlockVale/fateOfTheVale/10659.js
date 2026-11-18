// 10659 山谷的命运（版本三） Fate of the Vale (v.III) · 幕（3a）（fateOfTheVale · 山谷的命运 P7）
// 归属：关卡专用 · theFeastOfHemlockVale/fateOfTheVale（遭遇组 fate_of_the_vale）。
// 卡面：[action] 花费 X/人 线索：在你的地点放置 X 个资源作为引线（可花费 5 资源或弃掉 1 张[[道具]]支援以额外放置 1 个引线）。[action] 若你地点的引线 ≥ 隐藏值：移除全部引线，抽取 1 张放一边的「着火了！」（团队每地点一次）。目标 - 轮末若场上有 5 张「着火了！」，立即推进。
//
// 一张卡一个文件：条目只声明身份与规则数据（flags），行为接线在章节 behavior：
//   · flags.kindling → behavior.placeKindling / drawFire / objectiveStatus
//   · flags.fireTreacheryCode → behavior.drawFire
//   · flags.back = 'resolution4' → behavior.actReveal / resolutionOf
// 背面「Up in Flames」→ 结局 4。
export default {
  code: '10659',
  scope: 'act',
  implemented: true,
  flags: {
    kindling: {
      cluesPerKindling: 'perInvestigator',
      extraKindlingResources: 5,
      fireCopiesToAdvance: 5,
      groupLimit: 'oncePerLocation',
    },
    fireTreacheryCode: '10743',
    back: 'resolution4',
  },
  note: '近似：「花费 X/人 线索放 X 引线」在 behavior.placeKindling 里按 1/人 线索 = 1 引线逐次结算（一次行动不解析 X）；花费 5 资源/弃道具换额外引线的选项未接线。',
  abilities: [],
}
