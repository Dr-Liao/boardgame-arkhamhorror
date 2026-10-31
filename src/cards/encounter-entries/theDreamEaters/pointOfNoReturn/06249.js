// 06249 · 《无归之地》议程 2a「怪物围困」（Beset by Monsters，doom 4）。
// 卡面（背面 / 推进）：Each investigator must either discard 1 card at random from their hand or
//   lose 2 resources. Shuffle the encounter discard pile into the encounter deck.
//   Place 1 damage on the scenario reference card. Then:
//   - If there are 5 or more damage tokens on the scenario reference card, proceed to (→R2).
//   - Otherwise, flip this agenda back over.
//
// 「翻回正面」在引擎里用 `agendaWouldAdvance` 取消推进 + 自行清空在场毁灭 + Distortion 累计表达
// （behavior.js 的 besetByMonsters 流程读本条目的 flags，不写卡号分支）。

export default {
  code: '06249',
  scope: 'agenda',
  implemented: true,
  flags: {
    advanceRule: 'besetByMonsters',
    // 推进选择：随机弃 1 张手牌 或 失去 2 资源（有手牌/资源才提供该项）。
    advanceChoice: { discardRandom: 1, loseResources: 2 },
    shuffleDiscardOnAdvance: true,
    distortionOnAdvance: 1,
    // Distortion ≥ 5 时进入 R2；否则议程翻回正面（不推进）。
    finishAtDistortion: 5,
    revertOnAdvance: true,
  },
}
