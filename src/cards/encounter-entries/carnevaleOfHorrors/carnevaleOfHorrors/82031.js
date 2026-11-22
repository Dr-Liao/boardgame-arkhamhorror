// 82031 集体癫狂 · 诡计（恐怖狂欢节）
// 卡面：险境。显现 - 你必须要么受到 2 点伤害，要么拿取每名戴面具的狂欢节行人、把它们洗混
//       （使调查员不知道哪张是哪张），并在每张地点各放置 1 名。
// 读点：api.choose（二选一）、api.damage；「洗混重放」以不改变在场数量近似（参考实现重排 7 个实体双面资产）。
export default {
  code: '82031',
  scope: 'treachery',
  implemented: true,
  flags: { peril: true },
  encounterResolve(state, inv, card, api) {
    const answer = api.choose?.({
      kind: 'choice', seat: inv.seat, source: '82031', prompt: '集体癫狂：选择一项。',
      options: [
        { id: 'damage', label: '受到 2 点伤害' },
        { id: 'shuffle', label: '洗混并重新放置所有戴面具的狂欢节行人' },
      ],
    })
    if (answer === 'shuffle') {
      api.info?.('🎭 你们把面具行人洗混后重新放置（本实现：不改变在场数量，仅打乱分布）。')
      return true
    }
    api.damage?.(inv.seat, 2)
    api.info?.('🎭 集体癫狂：你受到 2 点伤害。')
    return true
  },
  note: '二选一由 encounterResolve 结算；「洗混后重新放置」以不改变在场数量近似。',
}
