// 10543b 活的门厅 / Living Foyer · 敌人-地点（双面卡的背面）（The Feast of Hemlock Vale · hemlockHouse）
//
// 归属：关卡专用 · hemlockHouse；与地点 10543（门厅）是同一张物理卡的两面。
// 规则：敌人-地点同时是敌人与地点（该敌人视为在该地点），可被攻击/躲避/调查；不能被卡效果移动。
// 引擎：翻面走 api.turnLocationIntoEnemy（无 api 时 behavior.flipToEnemySide 本地实现同形状）；
// 被击败后进胜利展示区，并让同列上方地点整体下移（src/engine/enemy-location.js）。
// 背面被揭示的强制效果在 behavior.applyEnemyLocationReveal 按 revealEffect 结算。

export default {
  "code": "10543b",
  "scope": "enemy",
  "implemented": true,
  "flags": {
    "enemyLocation": true,
    "doubleSided": true,
    "pairedLocationCode": "10543",
    "massive": true,
    "cannotBeMoved": true,
    "cannotMakeAttacksOfOpportunity": true,
    "fight": 2,
    "evade": 3,
    "health": 3,
    "damage": 2,
    "horror": 0,
    "victory": 0,
    "revealEffect": "attacksHere"
  },
  "abilities": [],
  "note": "近似：「+N [per_investigator] 生命」只在数据里声明（引擎当前没有敌人-地点按人加生命的读点）；揭示强制效果按 revealEffect 在 behavior 里分派。"
}
