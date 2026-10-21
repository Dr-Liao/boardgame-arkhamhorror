// 04039 失败的代价
// 卡面：显现 - 受到2点伤害和2点恐惧。在当前密谋上放置1个毁灭标记(本效果能导致当前密谋推进)。将失败的代价从你的牌库中移除。查找收藏，找出黑暗契约，并将其放入你的弃牌堆。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04039',
  abilities: [
    { kind: 'weakness', label: '失败的代价', weakness: { type: 'priceOfFailure' } },
  ],
  modifiers: [

  ],
}
