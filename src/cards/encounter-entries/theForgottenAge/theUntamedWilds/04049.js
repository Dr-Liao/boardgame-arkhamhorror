// 04049 守备森严的遗迹
// 归属：关卡专用 · theUntamedWilds（失落的时代 · 荒莽密林）
// 遭遇组：wilds
// 卡面：每个埃兹特里的守卫者敌人得到+1攻击值和+1躲避值。每个林中暗箭诡计获得涌动。
// 卡面：目标 - 只有在埃兹特里的遗迹的调查员能够共同花费所需数量的线索以推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '04049', scope: 'act',
  actRule: { onReveal(state, act, api) { api.finish('r2') } },
}
