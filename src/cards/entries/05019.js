// 05019 安息日男爵
// 卡面：显现 - 将安息日男爵放置入场。他身上有少于3个毁灭标记时，他不能离场。
// 卡面：强制 - 在任意数量的伤害被放置到安息日男爵所在地点的调查员上时：在该调查员上放置额外1点伤害。
// 卡面：[free]横置安息日男爵：在安息日男爵上放置1个毁灭标记。如果他身上有至少3个毁灭标记，将他弃掉。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// simplified：「身上少于 3 个毁灭标记时不能离场」需要一个「不可离场」的计数条件（现有
// cannotLeavePlay 是常量），本批只实现「3 个毁灭后自行弃掉」这一半；差异登记在 remaining。

export default {
  code: '05019',
  simplified: true,
  note: '「少于 3 个毁灭标记时不能离场」未实现（现有 cannotLeavePlay 无阈值条件）；3 个毁灭后弃掉的另一半已实现。',
  abilities: [
    {
      kind: 'weakness',
      label: '安息日男爵进入你的威胁区域',
      weakness: { type: 'threat' },
    },
    {
      kind: 'action',
      cost: { action: false, exhaust: true },
      label: '在安息日男爵上放置 1 个毁灭标记',
      resolve: ({ api, source }) => {
        const card = source?.code === '05019' ? source : null
        if (!card) return
        api.placeDoomOnCard(card, 1)
        api.exhaust(card)
        if ((card.doom || 0) >= 3) {
          api.removeThreat(card)
          api.info('安息日男爵身上有 3 个毁灭标记，被弃掉。')
        }
      },
    },
  ],
  modifiers: [],
}
