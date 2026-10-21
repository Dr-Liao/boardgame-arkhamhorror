// 02235 求生本能
// 卡面：如果尝试躲避期间本次技能检定成功，躲避的调查员可以立即躲避与其交战的每个其他敌人，并可以移动到一个连接地点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02235',
  abilities: [
    {
      kind: 'commit',
      label: '求生本能',
      skill: { onSuccess: { evadeDisengage: true, mayMoveAfterEvade: true } },
    },
  ],
  modifiers: [

  ],
}
