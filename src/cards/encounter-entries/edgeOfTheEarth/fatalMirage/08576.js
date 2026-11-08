// 08576 去世病人之记忆
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 数值由 definition 的 encounterDefinitions 取印刷数据；背面结算见 behavior.flipStoryFace。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08576',
  scope: 'enemy',
  implemented: true,
  enemyRule: { flipOnDefeat: true },
  flags: { eidolon: true, elite: true, memoryEnemy: true, ...{"retaliate":true,"preyPartner":"08590","reactionHealDamageBack":true,"flipOnDefeat":true} },
}
