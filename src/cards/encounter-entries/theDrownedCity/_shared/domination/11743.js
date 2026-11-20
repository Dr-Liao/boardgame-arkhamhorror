// 11743 支配（Domination）· 诡计 · 共享遭遇组 domination（印刷 1 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/domination。
// 卡面（cards-data 11743）：
//   险境。
//   显现 - 你必须决定(选择一项)：
//          - 在当前密谋上放置1个毁灭标记。本效果可以导致当前密谋推进。
//          - 每位调查员弃掉其手牌中的2张卡牌。
//          - 每位调查员失去1次行动。
//
// 读点（声明即接线）：
//   · 险境 = 印刷正文「Peril.」由章节 encounterDefinitions 解析（本条目 flags.peril 只作数据）；
//   · 「在当前密谋上放 1 毁灭，可导致推进」= api.addDoom(1)（act-agenda#addDoom 在放完后调用
//     checkAgenda，因此达到阈值会立刻推进密谋）；
//   · 「每位调查员弃 2 张手牌」= api.discardChosen(seat, 2, CODE)（逐张选择、受手牌保护约束）；
//   · 「每位调查员失去 1 次行动」= api.loseActions(seat, 1)（含 wouldLoseActions 取消窗口）。
const CODE = '11743'

export default {
  code: CODE,
  name: '支配',
  scope: 'treachery',
  implemented: true,
  flags: {
    traits: ['Power'],
    quantity: 1,
    peril: true,
    choices: ['doomOnAgenda', 'discardTwoPerInvestigator', 'loseOneActionPerInvestigator'],
  },
  encounterResolve(state, inv, card, api) {
    const answer = String(api.choice({
      kind: 'effect', source: CODE, seat: inv.seat,
      prompt: '「支配」：你必须决定（选择一项）。',
      options: [
        { id: 'doom', label: '在当前密谋上放置 1 个毁灭标记（可以导致密谋推进）' },
        { id: 'discard', label: '每位调查员弃掉其手牌中的 2 张卡牌' },
        { id: 'actions', label: '每位调查员失去 1 次行动' },
      ],
    }))
    const active = (state.investigators || []).filter(other => !other.defeated && !other.resigned)
    if (answer === 'discard') {
      for (const other of active) api.discardChosen(other.seat, 2, CODE)
      api.info?.('🐙 「支配」：每位调查员弃掉 2 张手牌。')
      return false
    }
    if (answer === 'actions') {
      for (const other of active) api.loseActions(other.seat, 1)
      api.info?.('🐙 「支配」：每位调查员失去 1 次行动。')
      return false
    }
    api.addDoom(1)
    api.info?.('🐙 「支配」：在当前密谋上放置 1 个毁灭标记（可导致密谋推进）。')
    return false
  },
  note: '险境由章节 encounterDefinitions 从印刷正文解析；三选一全部走既有 api：放置毁灭用 api.addDoom'
    + '（内部会检查密谋推进）、弃手牌用 api.discardChosen、失去行动用 api.loseActions。'
    + '选择者为显现者、之后对每位调查员结算，与参考「抽到者选择、逐人结算」一致。',
}
