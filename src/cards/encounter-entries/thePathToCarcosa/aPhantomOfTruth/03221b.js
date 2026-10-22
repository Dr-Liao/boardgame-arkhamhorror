// 03221b 风琴手
// 归属：关卡专用 · aPhantomOfTruth（卡尔克萨之路 · 真相幻影）
// 遭遇组：a_phantom_of_truth
// 卡面：冷漠。不能受到伤害。
// 卡面：强制 - 当敌军阶段结束时：如果风琴手未与调查员交战，将其朝着远离最近的调查员的方向移动1个地点(如可能，移动到一个没有调查员的地点)。如果其与调查员交战，改为其与调查员解除交战。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '03221b', scope: 'enemy', implemented: true,
  name: '风琴手',
  text: '冷漠。不能受到伤害。',
  flags: { organist: 'doubt' },
  modifiers: [{ target: 'cannot:beDamaged' }],
}
