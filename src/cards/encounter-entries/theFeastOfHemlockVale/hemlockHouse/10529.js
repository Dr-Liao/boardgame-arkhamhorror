// 10529 诡异住户 / Strange Infestation · 幕（The Feast of Hemlock Vale · hemlockHouse）
//
// 归属：关卡专用 · hemlockHouse；阶段 1a。
// 阶段数据（目标/背面文本）由章节 definition 的 stage() 从卡表读取；目标判定与背面结算在
// behavior.checkSealObjective / checkObjectives / actReveal。

export default {
  "code": "10529",
  "scope": "act",
  "implemented": true,
  "flags": {
    "stage": 1,
    "objectiveSeals": 7,
    "roundEndObjective": true,
    "sealAction": true,
    "cluesOnlyWithInvestigators": true,
    "setAsideAlternateAct": "10530",
    "cellarOnBack": true
  },
  "abilities": []
}
