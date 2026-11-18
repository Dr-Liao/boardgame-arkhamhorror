// 10583a 鳖类混种[day]（Limulus Hybrid · In the Light）· 双面敌人（白日面）
// 归属：关卡专用 · theFeastOfHemlockVale/theLostSister（P7 消失的姐妹）。
// 卡面：逃逸。庞大。鳖类混种得到 +3[per_investigator] 生命值且不能进行趁乱攻击。
//       强制 - 鳖类混种翻至此面后：对它造成 1[per_investigator] 点伤害。
//
// 一张卡一个文件：翻面判定在 behavior.syncHybridAt/flipHybrid（读 limulusHybrid / hybridSide /
// partnerCode）；生命值与趁乱限制走 behavior.enemyStatModifier 与 canOpportunityAttack。
export default {
  code: '10583a',
  scope: 'enemy',
  implemented: true,
  flags: {
    limulusHybrid: true,
    hybridSide: 'day',
    partnerCode: '10583b',
    healthPerInvestigatorBonus: 3,
    cannotOpportunityAttack: true,
    forcedOnFlipToThisSide: { damageToSelf: { perInvestigator: 1 } },
    keywords: ['elusive', 'massive'],
    victory: 2,
    elite: true,
    abomination: true,
    setAside: true,
  },
  note: '双面同一实体：翻面走 physical-faces.js（保留 id/伤害/横竖/附属/线索），强制伤害在 flipHybrid 里结算。',
}
