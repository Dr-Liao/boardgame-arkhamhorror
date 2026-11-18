// 10566 水晶残骸 · 孩子 · 剧情资产（寂静荒野，放一边暗放）
// 归属：关卡专用 · theFeastOfHemlockVale/theSilentHeath（P7 寂静荒野）。
// 卡面：Revelation - 将水晶残骸放置入场，放到你的游戏区域。
//       如果水晶残骸被击败，将其与遭遇牌库顶 2 张卡牌一起混洗，正面朝下成一堆放置到最近的
//       [[巢穴]]地点底下。
//       强制 - 在你的回合开始时：受到 1 点伤害或恐惧。
// 印刷：生命 1 / 理智 1 / 特性 [[Humanoid]][[Blight]] / 胜利 1。
// 读点：behavior.turnBegins 读 turnEffect（choice）→ 每回合开始二选一；
//       behavior.assetLeftPlay（crystalRemains）→ 击败后生成暗堆；
//       进入游戏区域在 behavior.giveCrystalRemains。
export default {
  code: '10566',
  scope: 'storyAsset',
  implemented: true,
  flags: { crystalRemains: true, turnEffect: { kind: 'choice', damage: 1, horror: 1 }, subname: 'child' },
  note: 'approximation：被击败后「不再进弃牌堆」用 leaveAsset 之后的 removedFromGame 标记抑制，'
    + '卡牌实体已写进地点底下的暗堆（behavior.beneathStacks）。',
}
