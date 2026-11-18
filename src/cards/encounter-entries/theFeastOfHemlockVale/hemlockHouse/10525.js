// 10525 吊诡的静默 / Eerie Silence · 议程（The Feast of Hemlock Vale · hemlockHouse）
//
// 归属：关卡专用 · hemlockHouse；阶段 1a，毁灭阈值 2。
// 阶段数据（毁灭阈值/背面文本）由章节 definition 的 stage() 从卡表读取；正面强制效果与背面结算在
// behavior.mythosEnded / agendaReveal。

export default {
  "code": "10525",
  "scope": "agenda",
  "implemented": true,
  "flags": {
    "stage": 1,
    "doom": 2,
    "variant": "base",
    "shuffleSetAsideTreacheriesOnBack": true,
    "resolvePredatoryHouseOnBack": true,
    "flipNearestDormantOnBack": true
  },
  "abilities": []
}
