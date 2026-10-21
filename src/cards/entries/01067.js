// 01067 无所畏惧
// 卡面：如果本次技能检定成功，治愈1点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01067',
  abilities: [
    { kind: 'commit', label: '无所畏惧', skill: { onSuccess: { healHorror: 1 } } },
  ],
  modifiers: [

  ],
}
