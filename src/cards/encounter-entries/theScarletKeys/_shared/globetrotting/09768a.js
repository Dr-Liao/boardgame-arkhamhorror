// 09768a 镜刃（The Mirroring Blade · 稳定面）· 密钥 · globetrotting
// 卡面：变换 - 对你所在地点的一个敌人造成 2 点伤害，或对你所在地点的每个敌人造成 1 点伤害。
//   将本钥匙翻至[[动荡]]面。
// 读点：abilities free（调查员把密钥当快速能力变换：实体是当前物理面的卡，牌桌/玩家窗口枚举）；
//   assetRule.keyShift（敌人强制变换钥匙时由其他条目通过 _lookup 调用，见 red_coterie/09752.js）。
// 近似：密钥必须作为当前物理面实例进场（绑定/放置由战役层完成）；「变换」读点见
//   primitive-requests/09768a.json（TSK 密钥的进场与 shift 触发仍在战役层）。
const CODE = '09768a'
const KEY_TITLE = '09768'

function enemiesHere(state, inv) {
  const locationId = inv?.location
  if (!locationId) return []
  return (state.enemies || []).filter(enemy => !enemy.defeated && enemy.location === locationId)
}

function resolveFace({ state, api, inv }) {
  const enemies = enemiesHere(state, inv)
  const seat = inv?.seat ?? null
  if (!enemies.length) {
    api.info?.('「镜刃」：你所在地点没有敌人，变换只翻面。')
    return { damaged: 0 }
  }
  const mode = String(api.choice({
    kind: 'effect', source: CODE, seat: seat ?? 0,
    prompt: '「镜刃」：选择变换效果。',
    options: enemies.length > 1
      ? [{ id: 'one', label: '对一个敌人造成 2 点伤害' }, { id: 'all', label: '对每个敌人造成 1 点伤害' }]
      : [{ id: 'one', label: '对「' + (enemies[0].name || enemies[0].code) + '」造成 2 点伤害' }],
  }))
  if (mode === 'all') {
    for (const enemy of enemies) api.damageEnemy(enemy, 1, seat, CODE)
    return { damaged: enemies.length, mode: 'all' }
  }
  const target = enemies.length === 1 ? enemies[0] : enemies.find(enemy => String(enemy.id) === String(api.choice({
    kind: 'enemy', source: CODE, seat: seat ?? 0,
    prompt: '选择受到 2 点伤害的敌人。',
    options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.code })),
  }))) || enemies[0]
  api.damageEnemy(target, 2, seat, CODE)
  return { damaged: 1, mode: 'one' }
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
  flags: { scarletKey: true, keyTitle: KEY_TITLE, keyFace: 'stable', pairCode: '09768b' },
  assetRule: { keyShift: { face: 'stable', resolve: ({ state, api, inv }) => resolveFace({ state, api, inv }) } },
  abilities: [{
    kind: 'free',
    actionKind: 'activate',
    label: '变换（镜刃·稳定面）：对你所在地点的敌人造成伤害，然后翻至动荡面',
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
      const result = resolveFace({ state, api, inv })
      api.tsk.keys.shift(key.id)
      api.info?.('「镜刃」变换完成并翻至动荡面（伤害目标 ' + (result.damaged || 0) + ' 个）。')
      return true
    },
  }],
  note: 'approximation: 密钥需以当前物理面实例进场；敌人强制变换走 assetRule.keyShift（red_coterie 条目调用），'
    + '两者共用同一段 resolveFace（primitive-requests/09768a.json：密钥进场与 shift 时机的战役层契约）。',
}
