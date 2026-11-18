// 10531 庄园之心 / The Heart of the House · 幕（The Feast of Hemlock Vale · hemlockHouse）
//
// 归属：关卡专用 · hemlockHouse；阶段 2a。
// 阶段数据（目标/背面文本）由章节 definition 的 stage() 从卡表读取；目标判定与背面结算在
// behavior.checkSealObjective / checkObjectives / actReveal。

export default {
  "code": "10531",
  "scope": "act",
  "implemented": true,
  "flags": {
    "stage": 2,
    "sealAction": true,
    "cluesOnlyWithInvestigators": true,
    "objectiveShapelessCellarVictory": true,
    "forcedMoveToCellarOnEnemyLocationAttack": true,
    "flipEnemyLocationsOnBack": true
  },
  "abilities": []
}
