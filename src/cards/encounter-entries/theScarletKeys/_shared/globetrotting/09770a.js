// 09770a 灾毁之钟（The Ruinous Chime · 稳定面）· 密钥 · globetrotting
// 卡面：变换 - 自动躲避你所在地点的所有敌人。将本钥匙翻至[[动荡]]面。
// 读点同 09768a；自动躲避走 api.autoEvadeEnemy（每个敌人结算一次引擎躲避）。
const CODE = '09770a'
const KEY_TITLE = '09770'

function enemiesHere(state, inv) {
  const locationId = inv?.location
  if (!locationId) return []
  return (state.enemies || []).filter(enemy => !enemy.defeated && enemy.location === locationId)
}

function resolveFace({ state, api, inv }) {
  const enemies = enemiesHere(state, inv)
  for (const enemy of enemies) api.autoEvadeEnemy(enemy)
  api.info?.('「灾毁之钟」自动躲避了 ' + enemies.length + ' 个敌人。')
  return { evaded: enemies.length }
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
  flags: { scarletKey: true, keyTitle: KEY_TITLE, keyFace: 'stable', pairCode: '09770b' },
  assetRule: { keyShift: { face: 'stable', resolve: ({ state, api, inv }) => resolveFace({ state, api, inv }) } },
  abilities: [{
    kind: 'free',
    actionKind: 'activate',
    label: '变换（灾毁之钟·稳定面）：自动躲避你所在地点的所有敌人，然后翻至动荡面',
    resolve: ({ state, inv, api }) => {
      const key = currentKey(api, inv)
      if (!key) return false
      if (api.tsk.keys.shiftedThisRound(key.id)) return false
      resolveFace({ state, api, inv })
      api.tsk.keys.shift(key.id)
      api.info?.('「灾毁之钟」变换完成并翻至动荡面。')
      return true
    },
  }],
  note: 'approximation: 自动躲避用引擎的 api.autoEvadeEnemy（会走躲避结算与「躲避成功后」窗口，'
    + '与基础「自动躲避」口径一致）。',
}
