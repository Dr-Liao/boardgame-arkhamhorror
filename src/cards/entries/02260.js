// 02260 领导力
// 卡面：领导力投入到另一位调查员执行的技能检定中时，领导力获得[willpower][wild]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02260',
  abilities: [
    { kind: 'commit', label: '领导力', skill: { leadership: true } },
  ],
  modifiers: [

  ],
}
