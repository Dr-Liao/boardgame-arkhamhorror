// 10528 墙壁活了 / Living Walls · 议程（The Feast of Hemlock Vale · hemlockHouse）
//
// 归属：关卡专用 · hemlockHouse；阶段 3a，毁灭阈值 8。
// 阶段数据（毁灭阈值/背面文本）由章节 definition 的 stage() 从卡表读取；正面强制效果与背面结算在
// behavior.mythosEnded / agendaReveal。

export default {
  "code": "10528",
  "scope": "agenda",
  "implemented": true,
  "flags": {
    "stage": 3,
    "doom": 8,
    "variant": "base",
    "forcedPredationAtMythosEnd": true,
    "fastFlipLocation": true,
    "backDefeatsInvestigators": true
  },
  "abilities": []
}
