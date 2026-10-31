// 06248 · 《无归之地》议程 1a「邪恶国度」（A Sinister Realm，doom 5）。
// 卡面（背面 / 推进）：Shuffle the encounter discard pile into the encounter deck.
//   Place 1 damage on the scenario reference card.
//
// 规则唯一实现在章节目录 behavior.js（agendaReveal/agendaAdvancing 按 flags.advanceRule 分派）；
// 本条目只声明卡面身份、implemented 读点与 behavior 的数据键（不写卡号分支的章节行为读这份 flags）。

export default {
  code: '06248',
  scope: 'agenda',
  implemented: true,
  flags: {
    advanceRule: 'aSinisterRealm',
    // 推进：遭遇弃牌堆洗回遭遇牌库 + 剧本参考卡上放 1 点伤害（Distortion）。
    shuffleDiscardOnAdvance: true,
    distortionOnAdvance: 1,
  },
}
