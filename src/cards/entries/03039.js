// 03039 急中生智
// 卡面：如果本次技能检定成功，选择你弃牌堆中一张名称不是急中生智的[survivor]卡牌。将所选卡牌加入你的手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03039',
  abilities: [
    {
      kind: 'commit',
      label: '急中生智',
      skill: { onSuccess: { returnDiscardClass: 'survivor', excludeSelf: true } },
    },
  ],
  modifiers: [

  ],
}
