// 10541 客厅 / Parlor · 地点（双面卡的正面）（The Feast of Hemlock Vale · hemlockHouse）
//
// 归属：关卡专用 · hemlockHouse；地点 id parlor，背面是敌人-地点 10541b。
// 卡面：连接/帷幕/线索由章节 definition 的 location() 从卡表读取；地点能力由 behavior.actions /
// performAction / afterInvestigate / placeSeal 承接。

export default {
  "code": "10541",
  "scope": "location",
  "implemented": true,
  "flags": {
    "locationId": "parlor",
    "enemyLocationCode": "10541b",
    "doubleSided": true,
    "printedShroud": 4,
    "cluesPerInvestigator": 2,
    "victory": 1,
    "rangedStrike": true
  },
  "abilities": []
}
