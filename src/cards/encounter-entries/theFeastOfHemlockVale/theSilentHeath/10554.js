// 10554 搜寻荒野 · 幕 2（寂静荒野）
// 归属：关卡专用 · theFeastOfHemlockVale/theSilentHeath（P7 寂静荒野）。
// 卡面：[action] 如果你所在地点没有线索：抽取你地点底下最顶上的卡牌。
//       [fast] 你所在地点的调查员共同花费 1[per_investigator] 个线索：查看你地点底下最顶上的
//       卡牌。你可以将该卡牌放到那堆卡牌最底下。
//       目标 - 如果所有未被击败的调查员都撤退，且胜利区有至少 1 张水晶残骸，推进。
// 背面（Laid to Rest）：检查胜利区水晶残骸张数；正好 3 张 → 结局 1，否则 → 结局 2。
// 读点：两个行动在 behavior.actions / performAction（silentHeathDrawBeneath / silentHeathPeekBeneath）；
//       目标在 behavior.checkObjectives / allResigned（maybeAdvanceAct2）；背面在 behavior.actReveal
//       的 act2Back（laidToRest 标记）。
export default {
  code: '10554',
  scope: 'act',
  implemented: true,
  flags: { laidToRest: true },
  note: '数据型条目：目标与背面分派在 behavior；行动是章节行为提供的 scenarioAction。',
  abilities: [],
}
