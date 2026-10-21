// 02031 困兽之笼
// 卡面：躲避。本次躲避尝试不使用[agility]，改为使用[willpower]。如果你检定成功且该敌人非[[精英]]，躲避该敌人并将困兽之笼附属到该敌人。
// 卡面：[reaction]在附属的敌人将要重整时：检定[willpower](3)。如果你检定成功，附属的敌人不重整。如果你检定失败，弃掉困兽之笼。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02031',
  abilities: [
    // Phase 5（5a-25）：卡号随效果数据走（引擎读 effect.code）。
    { kind: 'played', label: '困兽之笼', effect: { type: 'bindMonster', code: '02031' } },
  ],
  modifiers: [

  ],
}
