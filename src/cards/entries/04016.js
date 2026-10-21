// 04016 信使之声
// 卡面：显现 - 你必须(选择以下一项)：
// 卡面：- 受到1点直接伤害并承受1点肉体创伤。
// 卡面：- 受到1点直接恐惧并承受1点精神创伤。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04016',
  abilities: [
    { kind: 'weakness', label: '信使之声', weakness: { type: 'voiceOfTheMessenger' } },
  ],
  modifiers: [

  ],
}
