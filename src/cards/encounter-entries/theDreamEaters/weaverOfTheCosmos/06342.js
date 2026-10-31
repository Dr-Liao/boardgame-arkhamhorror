// 06342 巨网·缠结之网（地点，3 张）
// 归属：关卡专用 · weaverOfTheCosmos（P8 w-p8-f）。遭遇组：weaver_of_the_cosmos。
// 卡面：强制 - 在调查阶段结束时，如果本地点有调查员：在本地点上放置 1 个毁灭标记。
// 引擎没有「阶段结束」地点钩子；章节 behavior.phaseBegan('mythos')（调查阶段已结束）派发本
// 自定义钩子 onInvestigationPhaseEnd，覆盖「调查阶段结束时」的时点。
import { activeInvestigators } from '../../_shared.js'

export default {
  code: '06342',
  scope: 'location',
  implemented: true,
  locationRule: {
    onInvestigationPhaseEnd(state, location, api) {
      const present = activeInvestigators(state).some(inv => inv.location === location.id)
      if (!present) return
      api.locationDoom?.add(location, 1)
      api.info?.(`🕸️ 调查阶段结束：「${location.name}」上有调查员，在其上放置 1 个毁灭标记。`)
    },
  },
}
