// 09721 就在眼前（In Plain Sight） · 诡计 · mysteries_abound
// 归属：战役共用 · theScarletKeys/_shared/mysteriesAbound。
// 卡面：显现 - 附属到阴影中一个没有附属就在眼前的敌人上。如果你不能，就在眼前获得涌动。
//   强制 - 在你揭露附属的敌人后：该敌人攻击你，且直到本轮结束得到 +2 攻击。弃掉就在眼前。
//   Revelation - Attach to an enemy in the shadows without a copy of In Plain Sight attached.
//   If you cannot, In Plain Sight gains surge.
//   Forced - After you expose attached enemy: That enemy attacks you and gets +2 fight until the end
//   of the round. Discard In Plain Sight.
// 读点：
//   · 显现附属 = api.attachEncounterToEnemy（敌人附属唯一写入口）；「涌动」= 返回 { gainSurge: true }
//     （encounter.js#finishDraw 读 resolution.gainSurge）；
//   · 「阴影中的敌人」= 该敌人有一张未揭露的非诱饵迷你卡（kind === 敌人卡号）；迷你卡只读，
//     走 api.mechanics.tsk.concealed.miniCards()；
//   · 「+2 攻击直到本轮结束」= api.setEnemyRoundFightEvadeBonus(enemy, 2, { round })；
//   · 弃掉本卡 = api.cardsInPlayTreacheries() + api.discardCardInPlay（场上诡计的通用去除写入口）；
//   · 「揭露附属的敌人后」的时机：tsk-concealed 已注册 tskExposed 窗口，但引擎当前没有派发点
//     （揭露只走 tsk-interactions#expose），因此这里的强制能力在窗口派发接线后才自动生效；
//     请求见 artifacts/migration/tsk/primitive-requests/09721.json。
const CODE = '09721'

// 迷你卡 kind 只允许字母开头（tsk-concealed 的 KIND_PATTERN），敌人真身统一记作 enemy<卡号>。
const miniKindOf = code => `enemy${code}`
const inShadows = (state, code) => (state.scenarioFlags?.mechanics?.tsk?.concealed?.miniCards || [])
  .some(card => !card.decoy && (card.code != null ? card.code === code : card.kind === miniKindOf(code)))

const attachedTo = (state, enemy) => (enemy.attachments || [])
  .some(card => (card.originalCode || card.code) === CODE)

export default {
  code: CODE, scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const candidates = state.enemies.filter(enemy => inShadows(state, enemy.originalCode || enemy.code)
      && !attachedTo(state, enemy))
    if (!candidates.length) {
      api.info?.('「就在眼前」找不到阴影中没有附属同卡的敌人：获得涌动。')
      return { gainSurge: true }
    }
    const chosen = candidates.length === 1 ? candidates[0] : candidates.find(enemy => enemy.id === api.choose({
      kind: 'enemy', source: CODE, seat: inv.seat,
      prompt: '就在眼前：选择阴影中一个没有附属同卡的敌人。',
      options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.id })),
    })) || candidates[0]
    api.attachEncounterToEnemy(CODE, chosen.id)
    api.info?.(`🃏 「就在眼前」附属到阴影中的「${chosen.name}」。`)
    return { placed: true }
  },
  abilities: [{
    kind: 'forced', trigger: 'tskExposed', silent: true,
    label: '揭露附属的敌人后：该敌人攻击你并 +2 攻击直到本轮结束，弃掉本卡',
    criteria: ({ state, source, context }) => {
      const enemy = attachedEnemyOf(state, source)
      const exposedCode = context?.code ?? null
      const exposedKind = context?.kind ?? null
      if (!enemy || (exposedCode == null && exposedKind == null)) return false
      const enemyCode = String(enemy.originalCode || enemy.code)
      // 2026-11-13 P1-4：context.code 是权威印刷卡号；旧夹具只给 kind 时按 enemy<卡号> 回退。
      return exposedCode != null ? String(exposedCode) === enemyCode : exposedKind === miniKindOf(enemyCode)
    },
    resolve: ({ state, source, context, api }) => {
      const enemy = attachedEnemyOf(state, source)
      if (!enemy) return
      const seat = Number(context.seat)
      const inv = state.investigators[Number.isInteger(seat) ? seat : api.scenario.decideSeat()]
      if (!inv) return
      api.scenario.attack(enemy, inv)
      api.scenario.setEnemyRoundFightEvadeBonus(enemy, 2, { round: state.round })
      discardSelf(state, api, source)
      api.info?.(`🃏 「就在眼前」：${enemy.name} 攻击了 ${inv.name}，本轮攻击 +2。`)
    },
  }],
  note: 'approximation: 「揭露后」强制能力已实现但依赖 tskExposed 窗口派发（P2 只注册窗口，'
    + '引擎当前只在 tsk-interactions#expose 内揭露迷你卡、未开窗）；请求 09721 见 primitive-requests/。',
}

// 附属宿主：在敌人附属表里按实例找宿主（只读）。
function attachedEnemyOf(state, attachment) {
  return (state.enemies || []).find(enemy => (enemy.attachments || []).includes(attachment)) || null
}

// 场上诡计的通用去除：先按实例找到它，再交给 api.discardCardInPlay（遭遇弃牌堆）。
function discardSelf(state, api, source) {
  const row = api.cardsInPlayTreacheries().find(entry => entry.attachment === source)
  if (!row) return false
  return api.discardCardInPlay(row)
}
