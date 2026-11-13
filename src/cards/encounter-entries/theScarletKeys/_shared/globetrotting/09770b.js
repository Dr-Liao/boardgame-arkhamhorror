// 09770b 灾毁之钟（The Ruinous Chime · 动荡面）· 密钥 · globetrotting
// 卡面：变换 - 每位调查员受到 1 点直接恐惧。然后，如果是调查员变换了本钥匙，将其翻至[[稳定]]面。
// 读点同 09768a（abilities free + assetRule.keyShift）；直接恐惧走 api.directHorror。
const CODE = '09770b'
const KEY_TITLE = '09770'

function resolveFace({ state, api }) {
  const group = (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
  for (const inv of group) api.directHorror(inv.seat, 1)
  api.info?.('「灾毁之钟」（动荡面）：' + group.length + ' 位调查员各受到 1 点直接恐惧。')
  return { horrified: group.length }
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
  flags: { scarletKey: true, keyTitle: KEY_TITLE, keyFace: 'unstable', pairCode: '09770a' },
  assetRule: { keyShift: { face: 'unstable', resolve: ({ state, api }) => resolveFace({ state, api }) } },
  abilities: [{
    kind: 'free',
    actionKind: 'activate',
    label: '变换（灾毁之钟·动荡面）：每位调查员受到 1 点直接恐惧，然后翻至稳定面',
    resolve: ({ state, inv, api }) => {
      const key = currentKey(api, inv)
      if (!key) return false
      if (api.tsk.keys.shiftedThisRound(key.id)) return false
      resolveFace({ state, api })
      api.tsk.keys.shift(key.id)
      api.info?.('「灾毁之钟」由调查员变换：翻回稳定面。')
      return true
    },
  }],
  note: 'approximation: 敌人持有的密钥被强制变换时只结算动荡面效果、不翻回稳定面。',
}
