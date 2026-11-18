// 10591 植物勘察 · 幕 1（theThingInTheDepths）
// 归属：关卡专用 · theFeastOfHemlockVale/theThingInTheDepths（P7 深沼之物）。
// 卡面：目标 - 当一轮结束时，在北岸地点的调查员可以共同花费所需数量的线索以推进场景。
//   （所需数量 = 3 [per_investigator]；北岸是 3×3 网格的槽位标签。）
// 背面（机灵的土堆）：将放在一边的鳄龟混种敌人生成在北岸地点。选择一个与鳄龟混种所在地点
//   相邻的地点，在该地点生成 1 个放在一边的攫噬触须敌人。将放在一边的其他每张攫噬触须敌人
//   与遭遇弃牌堆一起混洗入遭遇牌库。
//
// 目标走引擎 objective（type 'clues'，atLocation 运行时改写为实际北岸 id，roundEndActIndex=0）；
// 背面由 behavior.actReveal 承接。数据型条目。
export default {
  code: '10591',
  scope: 'act',
  implemented: true,
  flags: {
    objective: { type: 'clues', perInvestigator: 3, atLocationSlot: 'northShore', timing: 'roundEnd' },
    back: { spawnHybridAtNorthShore: true, spawnTendrilAdjacent: 1, shuffleRemainingTendrils: true },
  },
  note: '数据型幕条目：目标由引擎 objective 结算（北岸 id 在 behavior.preScenarioSetup 写入），背面在 behavior.actReveal。',
  abilities: [],
}
