import { effectiveFloodLevel } from '../../_shared.js'

// 印刷规则包含攻击；本地 Haskell 只处理调查和躲避，依印刷卡文补齐攻击。
// trackTestTarget 由引擎提供带类型的真实目标，兼容远端目标、替代技能与重复地点副本。
export default {
  code: '07181',
  scope: 'storyAsset',
  assetRule: { trackTestTarget: true },
  modifiers: [{
    target: 'testValue',
    amount: ({ state, inv }) => {
      const test = state.skillTest
      if (!test || test.seat !== inv.seat) return 0
      let location
      if (test.actionKind === 'investigate' && test.target?.kind === 'location') location = test.target.id
      else if (['fight', 'evade'].includes(test.actionKind) && test.target?.kind === 'enemy') {
        location = state.enemies.find(enemy => enemy.id === test.target.id)?.location
      }
      if (!location || !state.locations.some(candidate => candidate.id === location)) return 0
      return effectiveFloodLevel(state, inv.seat, { location }) > 0 ? 1 : 0
    },
  }],
}
