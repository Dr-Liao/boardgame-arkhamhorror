// 09768b 镜刃（The Mirroring Blade · 动荡面）· 密钥 · globetrotting
// 卡面：变换 - 每位调查员受到 1 点直接伤害。然后，如果是调查员变换了本钥匙，将其翻至[[稳定]]面。
// 读点同 09768a（abilities free + assetRule.keyShift）。
// 近似：敌人强制变换时不翻回稳定面（规则：敌人持有的密钥保持动荡面）。
const CODE = '09768b'
const KEY_TITLE = '09768'

function resolveFace({ state, api }) {
  const group = (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
  for (const inv of group) api.directDamage(inv.seat, 1)
  api.info?.('「镜刃」（动荡面）：' + group.length + ' 位调查员各受到 1 点直接伤害。')
  return { damaged: group.length }
}

function currentKey(api, inv) {
  const keys = api.tsk.keys.all()
  return keys.find(key => (key.stable ? key.stableFace : key.unstableFace) === CODE
    && key.bearer.type === 'investigator' && key.bearer.seat === inv?.seat) || null
}

export default {
  code: CODE,
  scope: 'storyAsset',
  implemented: true,
  fast: true,
  flags: { scarletKey: true, keyTitle: KEY_TITLE, keyFace: 'unstable', pairCode: '09768a' },
  assetRule: { keyShift: { face: 'unstable', resolve: ({ state, api }) => resolveFace({ state, api }) } },
  abilities: [{
    kind: 'free',
    actionKind: 'activate',
    label: '变换（镜刃·动荡面）：每位调查员受到 1 点直接伤害，然后翻至稳定面',
    resolve: ({ state, inv, api }) => {
      const key = currentKey(api, inv)
      if (!key) {
        api.info?.('「镜刃」不在你身上（或当前面不匹配），无法变换。')
        return false
      }
      if (api.tsk.keys.shiftedThisRound(key.id)) {
        api.info?.('「镜刃」本轮已经变换过。')
        return false
      }
      resolveFace({ state, api })
      api.tsk.keys.shift(key.id)
      api.info?.('「镜刃」由调查员变换：翻回稳定面。')
      return true
    },
  }],
  note: 'approximation: 敌人持有的密钥被强制变换时只结算动荡面效果、不翻回稳定面（见 red_coterie/09752.js）。',
}
