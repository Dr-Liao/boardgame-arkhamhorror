// 09729 身染猩红（Bound in Red） · 诡计 · scarlet_sorcery
// 归属：战役共用 · theScarletKeys/_shared/scarletSorcery。
// 卡面：显现 - 如果场上没有 [[结社]] 敌人，身染猩红获得涌动。否则，将其附属到印刷生命值最高的 [[结社]] 敌人。
//   附属的敌人得到 +1 攻击、+1 躲避、+1 伤害和 +1 恐惧。
//   [action]：将你控制的一个 [[稳定]] 钥匙翻至 [[动荡]] 面。然后，弃掉身染猩红。任意地点的调查员均可以触发此能力。
//   Revelation - If there are no [[Coterie]] enemies in play, Bound in Red gains surge. Otherwise, attach
//   it to the [[Coterie]] enemy with the highest printed health. Attached enemy gets +1 fight, +1 evade,
//   +1 damage, and +1 horror. [action]: Flip a [[Stable]] key you control to its [[Unstable]] side. Then,
//   discard Bound in Red. An investigator at any location may trigger this ability.
// 读点：
//   · 附属 = api.attachEncounterToEnemy（敌人附属唯一写入口）；涌动 = 返回 { gainSurge: true }；
//   · 印刷生命值 = _shared.js 的 ALL_CARDS（cards-data 只读卡表，不读运行时修正）；
//   · 「+1 伤害 / +1 恐惧」= 条目 treacheryRule.attackBonus（enemies.js#enemyAttack 对敌人附属卡的唯一读点）；
//   · 「任意地点可触发的 [action]」= treacheryRule.attachmentAbilities（parley.js#entityActionDescriptors 与
//     parleyMovesFor 的「敌人身上的附属卡自身行动」分支；descriptor.range: 'anywhere'）；
//   · 钥匙翻面 = api.mechanics.tsk.keys.shift（绯红密钥变换唯一写入口；先读 keyChoices().canShift 避开每轮一次限制）；
//   · 弃掉本卡 = api.cardsInPlayTreacheries + api.discardCardInPlay（场上诡计通用去除）；
//   · 「+1 攻击 / +1 躲避」需要「附属卡对宿主敌人的数值修正」读点（modifiers 的 entity 行只认敌人自己/
//     所在地点/幕/议程，不认 enemy.attachments），见 primitive-requests/09729.json。
import { ALL_CARDS, hasTrait } from '../../../_shared.js'

const CODE = '09729'

// 印刷生命值（按人数印刷的敌人按当前人数换算，与 spawnEnemy 同口径）。
function printedHealth(state, enemy) {
  const card = ALL_CARDS[enemy.originalCode || enemy.code]
  const printed = Number(card?.health)
  if (!Number.isFinite(printed)) return Number(enemy.health) || 0
  return card.healthPerInvestigator ? printed * state.numInvestigators : printed
}

function discardSelf(api, source) {
  const row = api.cardsInPlayTreacheries().find(entry => entry.attachment === source)
  if (!row) return false
  return api.discardCardInPlay(row)
}

export default {
  code: CODE, scope: 'treachery', implemented: true,
  treacheryRule: {
    // 附属敌人 +1 伤害 / +1 恐惧：唯一读点在 enemies.js#enemyAttack（attackBonus）。
    attackBonus: { damage: 1, horror: 1 },
    // 「任意地点的调查员都可以触发」的 [action]。
    attachmentAbilities: [{
      kind: 'action', actionKind: 'activate', range: 'anywhere',
      label: '将你控制的一把[[稳定]]钥匙翻至[[动荡]]面，然后弃掉身染猩红',
      resolve: ({ inv, source, api }) => {
        const held = api.mechanics.tsk.keys.heldBy({ type: 'investigator', seat: inv.seat })
          .filter(id => api.mechanics.tsk.keys.get(id).stable === true
            && api.mechanics.tsk.keys.choices(id).canShift !== false)
        if (!held.length) {
          api.info?.(`🔑 ${inv.name} 没有可以翻面的[[稳定]]钥匙。`)
          return
        }
        const keyId = held.length === 1 ? held[0] : api.choose({
          kind: 'effect', source: CODE, seat: inv.seat,
          prompt: '身染猩红：选择一把[[稳定]]钥匙翻至[[动荡]]面。',
          options: held.map(id => ({ id, label: `密钥 ${id}（稳定面）` })),
        })
        api.mechanics.tsk.keys.shift(held.includes(keyId) ? keyId : held[0])
        discardSelf(api, source)
        api.info?.(`🔑 「${keyId}」翻至[[动荡]]面，「身染猩红」被弃掉。`)
      },
    }],
  },
  encounterResolve(state, inv, card, api) {
    const coterie = state.enemies.filter(enemy => hasTrait(enemy, 'Coterie'))
    if (!coterie.length) {
      api.info?.('「身染猩红」：场上没有[[结社]]敌人，获得涌动。')
      return { gainSurge: true }
    }
    const best = Math.max(...coterie.map(enemy => printedHealth(state, enemy)))
    const candidates = coterie.filter(enemy => printedHealth(state, enemy) === best)
    const target = candidates.length === 1 ? candidates[0] : candidates.find(enemy => enemy.id === api.choose({
      kind: 'enemy', source: CODE, seat: inv.seat,
      prompt: '身染猩红：选择印刷生命值最高（并列）的[[结社]]敌人。',
      options: candidates.map(enemy => ({ id: enemy.id, label: `${enemy.name}（生命 ${printedHealth(state, enemy)}）` })),
    })) || candidates[0]
    api.attachEncounterToEnemy(CODE, target.id)
    api.info?.(`🩸 「身染猩红」附属到「${target.name}」（+1 伤害、+1 恐惧）。`)
    return { placed: true }
  },
  note: 'approximation: 「+1 伤害/+1 恐惧」走 treacheryRule.attackBonus（唯一读点）；「+1 攻击/+1 躲避」缺少'
    + '「附属卡对宿主敌人的数值修正」读点（modifiers 的 entity 行不读 enemy.attachments），已在条目里逐条披露。'
    + '请求见 primitive-requests/09729.json。',
}
