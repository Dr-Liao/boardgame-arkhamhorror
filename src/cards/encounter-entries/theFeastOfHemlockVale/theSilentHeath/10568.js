// 10568 水晶残骸 · 母亲 · 剧情资产（寂静荒野，放一边暗放）
// 归属：关卡专用 · theFeastOfHemlockVale/theSilentHeath（P7 寂静荒野）。
// 卡面：Revelation - 将水晶残骸放置入场，放到你的游戏区域。
//       如果水晶残骸被击败，将其与遭遇牌库顶 2 张卡牌一起混洗，正面朝下成一堆放置到最近的
//       [[巢穴]]地点底下。
//       强制 - 在你的回合开始时：受到 1 点伤害。
// 印刷：生命 1（无理智上限）/ 特性 [[Humanoid]][[Blight]] / 胜利 1。
// 读点：behavior.turnBegins 读 turnEffect（damage）；击败暗堆同 10566。
export default {
  code: '10568',
  scope: 'storyAsset',
  implemented: true,
  flags: { crystalRemains: true, turnEffect: { kind: 'damage', damage: 1 }, subname: 'mother' },
  note: '印刷没有理智上限：受到恐惧不构成「被击败」。',
}
