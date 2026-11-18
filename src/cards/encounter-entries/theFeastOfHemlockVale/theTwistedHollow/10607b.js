// 10607b 类熊混种（发光异形） · 放一边的敌人（幕 1 背面）（theFeastOfHemlockVale/theTwistedHollow）
// 卡面：生成 - ([codex]Σ)(第37页)。猎手。反击。类熊混种得到 +2[per_investigator] 生命值。
//     强制 - 在类熊混种将要被击败时，如果是场景 2：不将其放入胜利区，改为治愈其全部伤害并放置到追击区域。
// 胜利 2。

export default {
  code: '10607b',
  scope: 'enemy',
  implemented: true,
  flags: {
    "ursineHybrid": true,
    "elite": true,
    "victory": 2,
    "hunter": true,
    "retaliate": true,
    "healthPerInvestigator": 2,
    "spawnCodex": "sigma",
    "victoryArea": true,
    "act2InsteadOfDefeat": true
  },
  note: "近似：「将被击败时改为进入追击」没有 cancelDefeat 原语 → behavior.enemyDefeated 返回 replaced，并在其中治愈+移入追击。",
  abilities: [],
}
