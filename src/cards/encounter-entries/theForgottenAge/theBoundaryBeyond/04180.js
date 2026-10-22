// 04180 特诺奇蒂特兰运河
// 归属：关卡专用 · theBoundaryBeyond（失落的时代 · 界限彼端）
// 遭遇组：the_boundary_beyond
// 卡面：位于特诺奇蒂特兰运河的每个敌人得到+2躲避值。
// 卡面：特诺奇蒂特兰运河有处于横置状态的敌人时，该地点隐藏值-3。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04180', scope: 'location',
  locationRule: {
    shroudModifier(state, location) {
      return state.enemies.some(enemy => enemy.location === location.id && enemy.exhausted) ? -3 : 0
    },
  },
}
