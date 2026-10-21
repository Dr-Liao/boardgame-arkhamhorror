// 04042 丧钟敲响
// 卡面：显现 - 你的死期到了。你阵亡了。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04042',
  abilities: [
    { kind: 'weakness', label: '丧钟敲响', weakness: { type: 'deathKnell' } },
  ],
  modifiers: [

  ],
}
