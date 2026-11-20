// 11504 盘问帮派 · 幕 1 版本 I（金盆洗手，Hibb's Roadhouse 线）
// 归属：关卡专用 · theDrownedCity/oneLastJob。
// 卡面：*本幕的总线索目标值 +1[per_investigator]。
//       [fast] 花费 X 个线索：谈判。弃掉你所在地点一名与你交战、剩余生命值为 X 的[[罪犯]]敌人。
//       在本幕上放置 1 个线索（从标记池中）。
//       目标 - 一轮结束时，如果本幕上的线索数量等于或超过其总线索目标值，推进。
// 印刷：线索阈值 2；背面把 Hibb's Roadhouse 放入东镇右侧、生成萨迪·谢尔顿并补齐幕牌库。
// 读点：behavior.checkObjectives 读 flags.clueThreshold/perInvestigatorBonus（2 + 1×人数）；
//       behavior.actions/performAction 的 oneLastJobParley 读 flags.parley；
//       behavior.actReveal 读 flags.linkedLocationId/bossCode。
export default {
  code: '11504',
  scope: 'act',
  implemented: true,
  flags: {
    clueThreshold: 2,
    perInvestigatorBonus: 1,
    parley: { discardEngagedCriminal: true, clueOnAct: 1 },
    linkedLocationId: 'hibbsRoadhouse',
    bossCode: '11510',
  },
  note: '数据型条目：阈值为「2 + 1[per_investigator]」（Haskell StaticWithPerPlayer 2 1）；'
    + '目标检查/谈判行动在 behavior。',
  abilities: [],
}
