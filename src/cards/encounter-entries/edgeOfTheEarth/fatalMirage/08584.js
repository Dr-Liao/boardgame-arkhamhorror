// 08584 恐怖阴影
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 数值由 definition 的 encounterDefinitions 取印刷数据；背面结算见 behavior.flipStoryFace。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08584',
  scope: 'enemy',
  implemented: true,
  enemyRule: { flipOnDefeat: false },
  flags: { eidolon: true, elite: false, memoryEnemy: false, ...{"aloof":true,"hunter":true,"losesAloofAtFlippedLocation":true,"doomOnClueDiscover":true} },
}
