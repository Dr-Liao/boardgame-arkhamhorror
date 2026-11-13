// The Scarlet Keys · 09758 · 敌人 · red_coterie（2026-11-13 重建：共享 shiftAttachedKeys helper 提取后按卡面重写）。
// 行为走描述子；「变换身上附属的每个钥匙」统一调用 ../../_shared.js#shiftAttachedKeys。
import { shiftAttachedKeys } from '../../../_shared.js'

const CODE = '09758'
export default {
  code: CODE, scope: 'enemy', implemented: true,
  flags: { coterie: true, elite: true },
  abilities: [{
    kind: 'forced', trigger: ['enemyPhaseBegins'],
    label: '巡逻（其他结社敌人所在地点）：沿最短路径移动 1 格',
    criteria: [({ state, source }) => Boolean(source) && (state.enemies || []).some(enemy =>
      enemy !== source && enemy.id !== source.id && enemy.location && enemy.location !== source.location
      && (enemy.traits || []).some(trait => String(trait).toLowerCase() === 'coterie'))],
    resolve: ({ state, source, api }) => {
      const mate = (state.enemies || []).find(enemy => enemy !== source && enemy.id !== source.id
        && (enemy.traits || []).some(trait => String(trait).toLowerCase() === 'coterie'))
      if (!mate) return false
      const paths = api.mechanics.map.paths(source.location, mate.location)
      const next = paths?.[0]?.[1]
      if (!next) return false
      api.moveEnemy?.(source, next)
      api.info?.('「德西德柔」沿最短路径移动到「' + next + '」。')
      return true
    },
  }, {
    kind: 'forced', trigger: ['harmAssigned'],
    label: '其他结社敌人在他的地点将受到伤害时：转移给他，然后变换他附属的每个钥匙',
    criteria: [({ source, context }) => Boolean(context?.damagedAssetIds?.length) && Boolean(source)],
    resolve: ({ state, source, api }) => {
      for (const inv of state.investigators || []) {
        for (const asset of [...(inv.assets || [])]) {
          if (!Array.isArray(state.__assignedAssetIds) || !state.__assignedAssetIds.includes(asset.id)) continue
          api.discardAsset?.(inv.seat, asset)
        }
      }
      const shifted = shiftAttachedKeys(source, { api, state })
      if (shifted) api.info?.('「德西德柔」变换了 ' + shifted + ' 把钥匙。')
    },
  }],
  note: 'approximation: 注：本文件在 2026-11-13 共享 helper 提取后重建，规则细节见 fix-plan P1-16。巡逻（其他结社敌人所在地点）+ 沿最短路移动 1 格已接线；伤害转移用 harmAssigned 窗口近似。',
}
