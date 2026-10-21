// 03231 重大发现
// 卡面：如果本次技能检定成功，执行本次检定的调查员查找其牌库顶3张卡牌，找出一张卡牌，将其抽取，并混洗其牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '03231',
  abilities: [
    { kind: 'commit', label: '重大发现', skill: { onSuccess: { searchTop: 3 } } },
  ],
  modifiers: [

  ],
}
