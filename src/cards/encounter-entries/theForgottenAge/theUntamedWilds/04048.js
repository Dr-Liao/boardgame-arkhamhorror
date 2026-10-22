// 04048 搜索遗迹
// 归属：关卡专用 · theUntamedWilds（失落的时代 · 荒莽密林）
// 遭遇组：wilds
// 卡面：每个埃兹特里的守卫者敌人不能攻击，也不能被攻击。忽略每个林中暗箭诡计的效果。
// 卡面：目标 - 只有在埃兹特里的遗迹的调查员能够共同花费所需数量的线索以推进场景。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 幕 04048 / 04049：第三幕即结局。

export default {
  code: '04048', scope: 'act',
  actRule: { onReveal(state, act, api) { api.finish('r1') } },
}
