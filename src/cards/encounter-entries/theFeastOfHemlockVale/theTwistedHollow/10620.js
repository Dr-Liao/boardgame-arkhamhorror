// 10620 熊穴 · 地点（西部树林）（theFeastOfHemlockVale/theTwistedHollow）
// 印刷：帷幕 3；线索 1[per_investigator]；特性 Forest、Lair、Dark。
// 已揭示面：熊穴；未揭示面：西部树林（Western Woods）。
// 卡面：强制 - 你揭示熊穴后：找出攻击值最高且处于追击中的敌人，将其生成并与你交战。如果你不能，抽取遭遇牌库顶的卡牌。
// 未揭示面入场；被揭示后由章节行为结算其强制效果（behavior.resolveLocationReveal）与议程 1 正面的铺树林。

export default {
  code: '10620',
  scope: 'location',
  implemented: true,
  flags: {
    "westernWoods": true,
    "printedShroud": 3,
    "printedClues": 1,
    "cluesPerInvestigator": true,
    "traits": [
      "Forest",
      "Lair",
      "Dark"
    ],
    "onReveal": "highestFightPursuitEngaged"
  },
  note: "近似：无追击敌人时走 api.drawEncounter；交战用 enemyZones.restore 的 engageSeat。",
  abilities: [],
}
