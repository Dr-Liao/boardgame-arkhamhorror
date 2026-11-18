// 10527 庄园动了(版本二) / The House Stirs (v.II) · 议程（The Feast of Hemlock Vale · hemlockHouse）
//
// 归属：关卡专用 · hemlockHouse；阶段 2a，毁灭阈值 5。
// 阶段数据（毁灭阈值/背面文本）由章节 definition 的 stage() 从卡表读取；正面强制效果与背面结算在
// behavior.mythosEnded / agendaReveal。

export default {
  "code": "10527",
  "scope": "agenda",
  "implemented": true,
  "flags": {
    "stage": 2,
    "doom": 5,
    "variant": "v2",
    "forcedPredationAtMythosEnd": true,
    "fastFlipLocation": true,
    "flipNearestDormantOnBack": true,
    "attachFireOnHighestFloor": true
  },
  "abilities": []
}
