// 03024 实地调查
// 卡面：[reaction]你移动到一个地点后，如果该地点至少有1个线索，横置实地调查：本阶段你执行的下一次技能检定得到技能值+2。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03024 田野调查：移动后（本地点有线索）横置，本阶段下一次技能检定 +2。
// 5c-18：不再走 carcosaPlayer 逃生原语，改成 api.phaseTestBonus（读点仍是 performTest 的
// inv.fieldwork，行为与迁移前一致）。

export default {
  code: '03024',
  abilities: [
    {
      kind: 'reaction', trigger: 'move', id: 'fieldwork', legacyReaction: true,
      criteria: { requiresClue: true }, label: '移动后本阶段下一次技能检定 +2',
      cost: { exhaust: true },
      resolve: ({ inv, api }) => { api.phaseTestBonus(inv.seat, 2) },
    },
  ],
  modifiers: [

  ],
}
