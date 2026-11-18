// 10540 藏书室 / Library · 地点（双面卡的正面）（The Feast of Hemlock Vale · hemlockHouse）
//
// 归属：关卡专用 · hemlockHouse；地点 id library40，背面是敌人-地点 10540b。
// 卡面：连接/帷幕/线索由章节 definition 的 location() 从卡表读取；地点能力由 behavior.actions /
// performAction / afterInvestigate / placeSeal 承接。

export default {
  "code": "10540",
  "scope": "location",
  "implemented": true,
  "flags": {
    "locationId": "library40",
    "enemyLocationCode": "10540b",
    "doubleSided": true,
    "printedShroud": 3,
    "cluesPerInvestigator": 1,
    "secretPassage": true
  },
  "abilities": []
}
