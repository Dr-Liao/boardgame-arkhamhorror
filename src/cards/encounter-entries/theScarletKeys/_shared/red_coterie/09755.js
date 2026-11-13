// The Scarlet Keys · 09755 · 敌人 · red_coterie（2026-11-13 重建：共享 shiftAttachedKeys helper 提取后按卡面重写）。
// 行为走描述子；「变换身上附属的每个钥匙」统一调用 ../../_shared.js#shiftAttachedKeys。
import { shiftAttachedKeys } from '../../../_shared.js'

const CODE = '09755'
export default {
  code: CODE, scope: 'enemy', implemented: true,
  enemyWeakness: { hunter: true },
  spawnFarthestFromAll: true,
  flags: { coterie: true, elite: true },
  abilities: [{
    kind: 'forced', trigger: ['skillTestFailed'],
    label: '在它所在地点检定失败且它重整时：变换它附属的每个钥匙',
    criteria: [({ state, source }) => {
      const test = state.skillTest
      if (!test || source?.exhausted === true || source?.defeated === true) return false
      const inv = state.investigators?.[test.seat]
      return Boolean(inv) && inv.location === source?.location
    }],
    resolve: ({ state, source, api }) => {
      const shifted = shiftAttachedKeys(source, { api, state })
      api.info?.('「深红斗篷的恶鬼」变换了 ' + shifted + ' 把钥匙。')
    },
  }],
  note: 'approximation: 注：本文件在 2026-11-13 共享 helper 提取后重建，规则细节见 fix-plan P1-16。猎手 + 生成-最远地点已接线；所在地点检定失败触发走 skillTestFailed 窗口。',
}
