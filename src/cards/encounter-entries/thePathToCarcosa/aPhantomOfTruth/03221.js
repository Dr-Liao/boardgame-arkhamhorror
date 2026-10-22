// 03221 风琴手
// 归属：关卡专用 · aPhantomOfTruth（卡尔克萨之路 · 真相幻影）
// 遭遇组：a_phantom_of_truth
// 卡面：猎手。不能受到伤害。
// 卡面：强制 - 风琴手通过猎手关键词移动后，如果其未与调查员交战：再次结算其猎手关键词。本阶段风琴手不能攻击。(每轮仅限一次。)
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 风琴手（03221 / 03221b）：不能受到伤害。
// 03221 的「猎手移动后再结算一次、本阶段不能攻击」与 03221b 的敌军阶段结束移动在章节 behavior。

export default {
  code: '03221', scope: 'enemy', implemented: true,
  name: '风琴手',
  text: '猎手。不能受到伤害。',
  flags: { organist: 'conviction' },
  modifiers: [{ target: 'cannot:beDamaged' }],
}
