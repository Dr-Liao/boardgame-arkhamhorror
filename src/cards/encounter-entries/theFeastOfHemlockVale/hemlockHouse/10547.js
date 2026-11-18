// 10547 失形地窖 / Shapeless Cellar · 敌人-地点（The Feast of Hemlock Vale · hemlockHouse）
//
// 归属：关卡专用 · theFeastOfHemlockVale/hemlockHouse（Setup 时放一边；幕 1 背面放入地窖层）。
// 卡面：Massive. Retaliate. 不能引发借机攻击；不能被封印或翻面。
//   强制 - 在失形地窖调查检定失败后：它攻击你。
//   强制 - 若其上没有线索：把它放进胜利展示区。
// 读点：behavior.placeCellar（入场即敌人-地点）/ afterInvestigate（失败攻击）/ checkCellarVictory。
export default {
  code: '10547',
  scope: 'enemy',
  implemented: true,
  flags: {
    enemyLocation: true,
    singleSided: true,
    massive: true,
    retaliate: true,
    cannotBeMoved: true,
    cannotBeSealed: true,
    cannotBeFlipped: true,
    cannotMakeAttacksOfOpportunity: true,
    cluesFixed: 3,
    fight: 3,
    evade: 2,
    health: 5,
    damage: 1,
    horror: 2,
    victory: 1,
    attacksOnFailedInvestigation: true,
    victoryWhenNoClues: true,
  },
  abilities: [],
  note: '近似：单面敌人-地点没有「地点面」，因此 location.enemyLocationFace 保存它自己的印刷面'
    + '（存档校验要求每个敌人-地点都有备用面），并用 cannotBeFlipped 保证 behavior 不会把它翻回地点面。',
}
