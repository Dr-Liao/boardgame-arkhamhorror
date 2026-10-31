// 06306 奈亚拉托提普 · 蠕行的混沌（Nyarlathotep · The Crawling Chaos）
// 卡面：险境。隐私。猎手。
//       显现 - 秘密地将奈亚拉托提普加入你的手牌。这张卡牌在你手牌中且未揭示时，如果你提到它，则你发疯。
//
// 本卡是《神居之所》5 个「奈亚拉托提普」复制品之一，以 Hidden 形式藏在调查员手牌里：
//   · `hiddenEnemyInHand`（引擎读点：moves.js 的手牌中攻击/躲避枚举、deck-ops 的隐私牌加入手牌）；
//   · 本剧本的剧情用法都在章节 behavior：
//       - 遭遇牌库抽到复制品 → 拦截生成（spawnLocation 哨兵 + spawnFailed）并秘密加入手牌；
//       - 被遗忘的高塔行动/议程与行动背面 → 揭示手中复制品（攻击或放入胜利区）；
//       - act 4 → 把胜利区里的复制品合成「奈亚拉托提普的真形」。
//   · `flags.nyarlathotepCopy` 是章节 behavior 读的「这是复制品」判据（不写死卡号）。
// 「提到它则发疯」是桌面口头约定，无法机械化判定 → worker 报告 simplified。
export default {
  code: '06306',
  scope: 'enemy',
  implemented: true,
  hiddenEnemyInHand: true,
  flags: { nyarlathotepCopy: true },
}
