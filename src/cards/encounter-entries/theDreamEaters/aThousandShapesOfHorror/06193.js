// 06193 诡计「欺骗性记忆」（Deceptive Memories）· 万千骇形
// 归属：关卡专用 · aThousandShapesOfHorror。卡面：
// 显现 - 将欺骗性记忆放置入场，放到你的威胁区域。
// 强制 - 在另一张卡牌进入你的威胁区域后：选择并弃掉你 1 张手牌。
// [action]：检定意志（3）。如果你检定成功，弃掉欺骗性记忆。
//
// 依据 Haskell Treachery/Cards/.../DeceptiveMemories.hs：
//   · 进威胁区 → encounterResolve 调 api.threat；
//   · [action] 检定意志（3）弃掉 → threatAction（共享层 performEncounterAction 统一检定+removeThreat）；
//   · 强制「另一张卡进入威胁区域后」：引擎没有「卡进入威胁区」读点，记 simplified（见 note）。
export default {
  code: '06193',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { threatArea: true },
  threatAction: {
    rule: 'tshDiscardDeceptiveMemories',
    label: '[action]：检定意志（3），成功弃掉「欺骗性记忆」',
    skills: ['willpower'],
    difficulty: 3,
    target: 'threat',
  },
  encounterResolve(state, inv, treachery, api) {
    api.threat?.(inv.seat, '06193')
    api.info?.(`🧠 「欺骗性记忆」进入 ${inv.name} 的威胁区域。`)
    return true
  },
  note: 'simplified：「强制 - 另一张卡进入你的威胁区域后，选择并弃掉 1 张手牌」没有「卡进入威胁区」的引擎读点；'
    + '其余子句（显现进威胁区、[action] 意志（3）弃掉本卡）已实现。',
}
