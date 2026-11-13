// 09769b 灾祸引擎（The Bale Engine · 动荡面）· 密钥 · globetrotting
// 卡面：变换 - 每位调查员失去 3 资源。然后，如果是调查员变换了本钥匙，将其翻至[[稳定]]面。
// 读点同 09768a/09769a（abilities free + assetRule.keyShift）。
const CODE = '09769b'
const KEY_TITLE = '09769'

function resolveFace({ state, api }) {
  const group = (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
  for (const inv of group) api.loseResources(inv.seat, 3)
  api.info?.('「灾祸引擎」（动荡面）：' + group.length + ' 位调查员各失去 3 资源。')
  return { lost: group.length }
}

function currentKey(api, inv) {
  return api.tsk.keys.all().find(key => (key.stable ? key.stableFace : key.unstableFace) === CODE
    && key.bearer.type === 'investigator' && key.bearer.seat === inv?.seat) || null
}

export default {
  code: CODE,
  scope: 'storyAsset',
  implemented: true,
  fast: true,
  flags: { scarletKey: true, keyTitle: KEY_TITLE, keyFace: 'unstable', pairCode: '09769a' },
  assetRule: { keyShift: { face: 'unstable', resolve: ({ state, api }) => resolveFace({ state, api }) } },
  abilities: [{
    kind: 'free',
    actionKind: 'activate',
    label: '变换（灾祸引擎·动荡面）：每位调查员失去 3 资源，然后翻至稳定面',
    resolve: ({ state, inv, api }) => {
      const key = currentKey(api, inv)
      if (!key) return false
      if (api.tsk.keys.shiftedThisRound(key.id)) return false
      resolveFace({ state, api })
      api.tsk.keys.shift(key.id)
      api.info?.('「灾祸引擎」由调查员变换：翻回稳定面。')
      return true
    },
  }],
  note: 'approximation: 敌人持有的密钥被强制变换时只结算动荡面效果、不翻回稳定面。',
}
