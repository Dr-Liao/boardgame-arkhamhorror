// 10543 门厅 / Foyer · 地点（双面卡的正面）（The Feast of Hemlock Vale · hemlockHouse）
//
// 归属：关卡专用 · hemlockHouse；地点 id foyer，背面是敌人-地点 10543b。
// 卡面：连接/帷幕/线索由章节 definition 的 location() 从卡表读取；地点能力由 behavior.actions /
// performAction / afterInvestigate / placeSeal 承接。

export default {
  "code": "10543",
  "scope": "location",
  "implemented": true,
  "flags": {
    "locationId": "foyer",
    "enemyLocationCode": "10543b",
    "doubleSided": true,
    "printedShroud": 2,
    "cluesPerInvestigator": 1,
    "fastMove": true,
    "resign": true
  },
  "abilities": []
}
