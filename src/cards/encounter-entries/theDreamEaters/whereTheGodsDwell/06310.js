// 06310 奈亚拉托提普 · 星间行者（Nyarlathotep · Stalker Among the Stars）
// 卡面：险境。隐私。庞大。
//       显现 - 秘密地将奈亚拉托提普加入你的手牌。这张卡牌在你手牌中且未揭示时，如果你提到它，则你发疯。
//
// 5 个「奈亚拉托提普」复制品之一：Hidden 敌人在手牌（hiddenEnemyInHand，引擎读点）。
// 复制品不在场上生成；揭示/攻击/洗回/进胜利区/合成真形都由章节 behavior 按卡面效果处理
// （塔行动、议程与行动背面、act 4）。`flags.nyarlathotepCopy` 供 behavior 识别复制品。
// 「提到它则发疯」无机械化读点 → simplified。
export default {
  code: '06310',
  scope: 'enemy',
  implemented: true,
  hiddenEnemyInHand: true,
  flags: { nyarlathotepCopy: true },
}
