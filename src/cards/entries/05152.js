// 05152 妥善养护
// 卡面：快速。只能在你回合期间打出。
// 卡面：附属到你控制的一张[[道具]]支援。每个支援仅限1张。
// 卡面：[reaction]所附属支援被弃掉后：将该支援返回其所有者手牌，
// 附属到该支援的其他所有[[升级]]附属也返回各自所有者的手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// P7：附属效果走条目级 attachTo + onAttach（引擎 doPlay 的「事件附属到支援」通道，04193 同通道），
// maxPerTarget 保证「每个支援仅限 1 张」。反应部分需要「支援被弃置后」的窗口，
// 引擎的 leaveAsset 不触发任何玩家卡窗口（只有章节钩子），因此显式简化。

export default {
  code: '05152',
  fast: true,
  attachTo: { kind: 'asset', trait: 'item', maxPerTarget: 1 },
  playCondition: [{ when: ({ state, inv }) => state.currentSeat === inv.seat, message: '只能在你自己的回合打出' }],
  simplified: true,
  note: '未实现：所附属支援被弃掉后「把它和其余[[升级]]附属返回各自所有者手牌」——引擎的 leaveAsset 不触发玩家卡反应窗口（没有「支援被弃置后」的窗口 id），现有原语无法表达；主要效果（快速附属到[[道具]]支援、每个支援限 1 张）已实现。',
  abilities: [],
  modifiers: [],
}
