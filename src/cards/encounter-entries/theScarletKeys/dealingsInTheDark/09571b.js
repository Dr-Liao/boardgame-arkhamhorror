// 09571b 解封（The Unsealing）· 剧情卡（彰显的翻面）· dealings_in_the_dark
// 卡面：每个非弱点敌人获得：「猎手。猎物 - 拥有扭曲反棱镜的调查员。」如果扭曲反棱镜附属到该敌人，
//       它改为获得「巡逻（加拉塔码头）」。
//   强制 - 在毁灭标记将要放置到敌人时：改为该敌人移动并攻击，如同此刻是敌军阶段（不要横置）。
//   强制 - 在非弱点敌人攻击有扭曲反棱镜的调查员后：将扭曲反棱镜附属到该敌人，动荡面朝上。
//          然后，该敌人变换它。
//   [reaction] 你躲避或击败有扭曲反棱镜的敌人后：控制扭曲反棱镜，将其附属到你的调查员。
// 读点：
//   · 猎手/猎物/巡逻的授予由本章 behavior.applyUnsealingKeywords 统一执行（读 flags.grantsHunterPrey；
//     敌人实例字段 hunter / preySeat / patrol，巡逻由 tsk-coterie 的 patrolDestination 读取）。
//   · 「毁灭改为移动+攻击」由 behavior.doomPlaced 执行（读 flags.doomReplacementMovesAndAttacks）；
//     引擎没有「毁灭放置替换」的返回值，实施口径为「把刚放的毁灭移除 + resolveEnemyPhaseOf」。
//   · 攻击持钥者 / 夺回密钥 = behavior 事件 dealingsKeyStolenByEnemy / dealingsTakeKeyByInvestigator
//     （密钥实体与变换的唯一写点，见 primitive-requests/09590.json）。
const CODE = '09571b'

const KEY_ID = '09590'

/** 当前密钥持有者：优先读战役级密钥实体，未初始化时读本章剧本标记。 */
function keyBearer(state) {
  const record = state.campaign?.tsk?.keys?.keys?.[KEY_ID] || null
  if (record?.bearer) return record.bearer
  const flags = state.scenarioFlags?.twistedAntiprismBearer
  return flags && typeof flags === 'object' ? flags : { type: 'none' }
}

function keyHeldByEnemy(state, enemy) {
  const bearer = keyBearer(state)
  return Boolean(enemy && bearer.type === 'enemy' && bearer.enemyId === enemy.id)
}

export default {
  code: CODE,
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyRule: 'theUnsealing',
    grantsHunterPrey: true,
    doomReplacementMovesAndAttacks: true,
    stealsKeyOnAttack: true,
    patrolLocationId: 'galataDocks',
  },
  abilities: [{
    kind: 'forced',
    trigger: 'enemyAttacked',
    silent: true,
    label: '非弱点敌人攻击持钥者后：把扭曲反棱镜附属到该敌人（动荡面），然后该敌人变换它',
    criteria: ({ state, context }) => {
      const enemy = context?.enemy
      if (!enemy || !(state.enemies || []).includes(enemy)) return false
      const bearer = keyBearer(state)
      return bearer.type === 'investigator' && bearer.seat === context.seat
    },
    resolve: ({ context, api }) => {
      const result = api.scenario.resolveScenarioEvent('dealingsKeyStolenByEnemy', { enemyId: context.enemy.id })
      if (!result) api.info?.('「解封」：密钥夺取未能结算（敌人已离场）。')
    },
  }, {
    kind: 'reaction',
    trigger: ['evadeSuccess', 'enemyDefeated'],
    label: '你躲避或击败持钥敌人后：控制扭曲反棱镜并附属到你的调查员',
    // enemyDefeated 窗口里敌人已经离场（state.enemies 不含它），因此只按「密钥持有者」判定。
    criteria: ({ state, context }) => Boolean(context?.enemy && keyHeldByEnemy(state, context.enemy)),
    resolve: ({ state, inv, context, api }) => {
      const seat = Number.isInteger(context?.seat) ? context.seat : inv.seat
      api.scenario.resolveScenarioEvent('dealingsTakeKeyByInvestigator', { seat })
      api.info?.(`🔑 ${state.investigators[seat]?.name || '调查员'} 从「${context.enemy.name}」夺回扭曲反棱镜。`)
    },
  }],
  note: 'approximation: 「毁灭改为移动+攻击」实现为「移除刚放置的毁灭 + resolveEnemyPhaseOf」'
    + '（引擎没有毁灭放置替换入口）；敌人变换动荡面时不翻面（原语 shiftKey 恒翻面）。'
    + '见 primitive-requests/09571b.json。',
}
