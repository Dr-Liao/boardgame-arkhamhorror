// 10550 不安的宁静 · 议程（寂静荒野 1/2）
// 归属：关卡专用 · theFeastOfHemlockVale/theSilentHeath（P7 寂静荒野）。
// 卡面：强制 - 在毁灭标记放置到本密谋时，如果族群虫后敌人放在一边：从混乱袋中揭示标记，
//       数量等于胜利区中[[昆虫]]敌人的数量。如果揭示了[skull]或[auto_fail]标记，
//       生成放在一边的族群虫后敌人。
// 读点：behavior.doomPlaced 读本节目的 spawnBroodQueenOnDoom 决定触发集合
//       （'skullOrAutoFail' = 骷髅 / 自动失败）。阈值 8 由卡表 doom 字段供 stage()。
export default {
  code: '10550',
  scope: 'agenda',
  implemented: true,
  flags: { spawnBroodQueenOnDoom: 'skullOrAutoFail' },
  note: '数据型条目：阈值/正反面由 definition.stage() 读取卡表；强制能力在 behavior.doomPlaced。',
  abilities: [],
}
