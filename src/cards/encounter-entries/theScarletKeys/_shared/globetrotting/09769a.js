// 09769a 灾祸引擎（The Bale Engine · 稳定面）· 密钥 · globetrotting
// 卡面：变换 - 为你所在地点调查员控制的任一支援增加 1 子弹、充能、秘密、补给或证据。
//   将本钥匙翻至[[动荡]]面。
// 读点同 09768a；加充能走 api.addUses（按支援的 usesType），候选只列五类使用次数。
// 近似：同时具备多种 usesType 的支援按当前 usesType 判定；没有可加次数的支援时只翻面。
const CODE = '09769a'
const KEY_TITLE = '09769'
const TYPES = ['ammo', 'charges', 'secrets', 'supplies', 'evidence']

function candidates(state, inv) {
  const group = (state.investigators || []).filter(member => !member.defeated && !member.resigned
    && member.location === inv?.location)
  return group.flatMap(owner => (owner.assets || [])
    .filter(card => TYPES.includes(card.usesType))
    .map(card => ({ owner, card })))
}

function resolveFace({ state, api, inv }) {
  const options = candidates(state, inv)
  if (!options.length) {
    api.info?.('「灾祸引擎」：你所在地点没有可增加使用次数的支援。')
    return { added: 0 }
  }
  const picked = options.length === 1 ? options[0].card.id : String(api.choice({
    kind: 'asset', source: CODE, seat: inv?.seat ?? 0,
    prompt: '选择要增加 1 点使用次数的支援。',
    options: options.map(item => ({
      id: item.card.id,
      label: (api.cardName?.(item.card.code) || item.card.code) + '（' + item.card.usesType + '）',
    })),
  }))
  const found = options.find(item => item.card.id === picked) || options[0]
  api.addUses(found.card, 1)
  api.info?.('「灾祸引擎」：为「' + (api.cardName?.(found.card.code) || found.card.code) + '」增加 1 点 '
    + found.card.usesType + '。')
  return { added: 1, assetId: found.card.id }
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
  flags: { scarletKey: true, keyTitle: KEY_TITLE, keyFace: 'stable', pairCode: '09769b' },
  assetRule: { keyShift: { face: 'stable', resolve: ({ state, api, inv }) => resolveFace({ state, api, inv }) } },
  abilities: [{
    kind: 'free',
    actionKind: 'activate',
    label: '变换（灾祸引擎·稳定面）：为所在地点一个支援加 1 使用次数，然后翻至动荡面',
    resolve: ({ state, inv, api }) => {
      const key = currentKey(api, inv)
      if (!key) return false
      if (api.tsk.keys.shiftedThisRound(key.id)) return false
      resolveFace({ state, api, inv })
      api.tsk.keys.shift(key.id)
      api.info?.('「灾祸引擎」变换完成并翻至动荡面。')
      return true
    },
  }],
  note: 'approximation: 使用次数按支援现有的 usesType 增加（五类之一）；没有候选时只翻面。',
}
