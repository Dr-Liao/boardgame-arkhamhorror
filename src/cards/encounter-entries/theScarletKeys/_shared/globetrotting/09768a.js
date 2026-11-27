// 09768a 镜刃（The Mirroring Blade · 稳定面）· 密钥 · globetrotting
// 卡面：变换 - 对你所在地点的一个敌人造成 2 点伤害，或对你所在地点的每个敌人造成 1 点伤害。
//   将本钥匙翻至[[动荡]]面。
// 当前物理面由绯红密钥变换管线执行，战役持有记录决定合法变换者。
const CODE = '09768a'
const KEY_TITLE = '09768'

function resolveFace({ state, api, context }) {
  const { bearer, seat } = context
  const location = bearer.type === 'investigator'
    ? state.investigators[bearer.seat]?.location
    : state.enemies.find(enemy => enemy.id === bearer.enemyId)?.location
  const enemies = location == null ? [] : state.enemies.filter(enemy => !enemy.defeated && enemy.location === location)
  if (!enemies.length) {
    api.info?.('「镜刃」：你所在地点没有敌人，变换只翻面。')
    return { damaged: 0 }
  }
  const chooser = seat ?? api.scenario.decideSeat()
  const mode = enemies.length > 1 ? api.choice({
    kind: 'effect', source: CODE, seat: chooser,
    prompt: '「镜刃」：选择变换效果。',
    options: [{ id: 'one', label: '对一个敌人造成 2 点伤害' }, { id: 'all', label: '对每个敌人造成 1 点伤害' }],
  }) : 'one'
  if (mode === 'all') {
    for (const enemy of enemies) api.damageEnemy(enemy, 1, seat, CODE)
    return { damaged: enemies.length, mode: 'all' }
  }
  const targetId = enemies.length === 1 ? enemies[0].id : api.choice({
    kind: 'enemy', source: CODE, seat: chooser,
    prompt: '选择受到 2 点伤害的敌人。',
    options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.code })),
  })
  const target = enemies.find(enemy => enemy.id === targetId)
  if (!target) return { damaged: 0 }
  api.damageEnemy(target, 2, seat, CODE)
  return { damaged: 1, mode: 'one' }
}

export default {
  code: CODE,
  scope: 'storyAsset',
  implemented: true,
  fast: true,
  flags: { scarletKey: true, keyTitle: KEY_TITLE, keyFace: 'stable', pairCode: '09768b' },
  assetRule: { shift: resolveFace },
}
