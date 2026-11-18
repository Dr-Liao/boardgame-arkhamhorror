// 10579 嶙峋海岸（Rocky Shoreline）· 岩穴地点
// 归属：关卡专用 · theFeastOfHemlockVale/theLostSister（P7 消失的姐妹）。
// 卡面：强制 - 在你揭示嶙峋海岸后：把一个放在一边的虾类混种敌人生成在本地点，（在光中）面朝上。
//
// 一张卡一个文件：揭示结算在 behavior.locationRevealed（读 onRevealSpawn + spawnSetAsideEnemy，
// 生成后立刻按黑暗状态同步双面，见 syncHybridAt）。
export default {
  code: '10579',
  scope: 'location',
  implemented: true,
  abilities: [],
  flags: {
    onRevealSpawn: { code: '10584a', side: 'light' },
    cluesPerInvestigator: 1,
    shroud: 3,
    traits: ['Coastal'],
  },
  note: '数据型条目：生成与随后的双面同步都在 behavior.locationRevealed，条目只声明来源与面。',
}
