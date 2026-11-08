// 08580 无法述说的恶魔之记忆
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 数值由 definition 的 encounterDefinitions 取印刷数据；背面结算见 behavior.flipStoryFace。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08580',
  scope: 'enemy',
  implemented: true,
  enemyRule: { flipOnDefeat: true },
  flags: { eidolon: true, elite: true, memoryEnemy: true, ...{"alert":true,"retaliate":true,"preyPartner":"08588","parleyShuffle3Damage3":true,"flipOnDefeat":true} },
}
