// 01091 压制
// 卡面：每次技能检定最多投入1张。
// 卡面：如果本次检定成功，抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01091',
  abilities: [
    { kind: 'commit', label: '压制', skill: { onSuccess: { draw: 1 } } },
  ],
  modifiers: [

  ],
}
