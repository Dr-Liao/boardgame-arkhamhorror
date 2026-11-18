// 10534 卧室 / Bedroom · 地点（双面卡的正面）（The Feast of Hemlock Vale · hemlockHouse）
//
// 归属：关卡专用 · hemlockHouse；地点 id bedroom34，背面是敌人-地点 10534b。
// 卡面：连接/帷幕/线索由章节 definition 的 location() 从卡表读取；地点能力由 behavior.actions /
// performAction / afterInvestigate / placeSeal 承接。
// 
// 帷幕 X = 本地点楼层 + 1（印刷动态值）：definition 先写 1 层占位，布置/滑动后由
// behavior.applyFloor 按网格 y 重算。

export default {
  "code": "10534",
  "scope": "location",
  "implemented": true,
  "flags": {
    "locationId": "bedroom34",
    "enemyLocationCode": "10534b",
    "doubleSided": true,
    "printedShroud": -2,
    "shroudRule": "floorPlusOne",
    "cluesPerInvestigator": 1,
    "afterSealReaction": true
  },
  "abilities": []
}
