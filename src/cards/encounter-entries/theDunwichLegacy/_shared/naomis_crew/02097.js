// 02097 欧巴尼恩暴徒
// 归属：战役共用 · theDunwichLegacy（敦威治遗产）
// 遭遇组：naomis_crew
// 卡面：欧巴尼恩暴徒与你交战时，你不能获得资源。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02097', scope: 'enemy',
  enemyRule: { blocksResourceGain: true },
}
