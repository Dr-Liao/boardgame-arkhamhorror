// 09768b 镜刃（The Mirroring Blade · 动荡面）· 密钥 · globetrotting
// 卡面：变换 - 每位调查员受到 1 点直接伤害。然后，如果是调查员变换了本钥匙，将其翻至[[稳定]]面。
// 动荡面由通用变换流程执行；敌人变换时保持动荡面。
const CODE = '09768b'
const KEY_TITLE = '09768'

function resolveFace({ state, api }) {
  const group = (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
  for (const inv of group) api.directDamage(inv.seat, 1)
  api.info?.('「镜刃」（动荡面）：' + group.length + ' 位调查员各受到 1 点直接伤害。')
  return { damaged: group.length }
}

export default {
  code: CODE,
  scope: 'storyAsset',
  implemented: true,
  fast: true,
  flags: { scarletKey: true, keyTitle: KEY_TITLE, keyFace: 'unstable', pairCode: '09768a' },
  assetRule: { shift: resolveFace },
}
