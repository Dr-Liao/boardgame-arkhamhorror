// 09089 束敌宝罐（Binder's Jar）· 秘术师支援 · 1 经验。
// 卡面：束敌宝罐底下每有一个敌人，你得到 +1 法术槽位。
//       [reaction] 你所在地点的非[[精英]]敌人被击败后：将该敌人正面朝下放在束敌宝罐底下
//       （底下仅限 2 个敌人）。
//       [reaction] 在敌人攻击你时，弃掉束敌宝罐底下与攻击敌人有[[特性]]相同的一个敌人：
//       取消该次攻击。
//
// 读点：
//   · 罐底计数 = 通用具名计数器 hollow（api.addCardCounter）+ commitOrigins 的宿主下方存储
//     （api.commitOrigins.store/beneath/take；与调查员下方牌共用同一份 beneath 容器）；
//   · 额外法术槽 = add:slot 修正（slotBonus 唯一读点），数量读 source.markers.hollow；
//   · 取消攻击 = context.cancelled（与 03106/「建议」同一读点）。
import { ALL_CARDS } from '../../cards/cards-data.js'

const cardTraitsFor = code => (ALL_CARDS[code]?.traits || []).map(trait => String(trait).toLowerCase())
const beneathCount = source => Math.min(2, Number(source?.markers?.hollow) || 0)

export default {
  code: '09089',
  modifiers: [
    {
      target: 'add:slot',
      value: 'arcane',
      amount: ({ source }) => beneathCount(source),
    },
  ],
  abilities: [
    {
      kind: 'reaction',
      trigger: 'defeatEnemy',
      label: '你所在地点的非精英敌人被击败后：把它压在束敌宝罐底下（最多 2 个）',
      criteria: [({ inv, source, context }) => {
        const enemy = context?.enemy
        if (!source || !enemy || enemy.elite) return false
        if (enemy.location !== inv.location) return false
        return beneathCount(source) < 2
      }],
      resolve: ({ state, inv, source, context, api }) => {
        const enemy = context?.enemy
        if (!source || !enemy) return
        const code = enemy.originalCode || enemy.code
        if (state.encounterDiscard?.includes(code)) {
          api.moveCard({ code, from: 'encounterDiscard', to: 'discard', ownerSeat: inv.seat })
        }
        if (!(inv.discard || []).includes(code)) {
          api.info(`🏺 「束敌宝罐」：找不到「${enemy.name || code}」的实体卡。`)
          return
        }
        api.commitOrigins.store(inv.seat, source.id, code, { from: 'discard' })
        api.addCardCounter(source, 'hollow', 1, { max: 2 })
        api.info(`🏺 「束敌宝罐」：将「${enemy.name || code}」压在罐底。`)
      },
    },
    {
      kind: 'reaction',
      trigger: 'enemyAttack',
      label: '敌人攻击你时：弃掉罐底一个有相同特性的敌人，取消该次攻击',
      criteria: [({ state, inv, source, context }) => {
        if (!source || context?.seat !== inv.seat || !context?.enemy) return false
        const stored = state?.scenarioFlags?.mechanics?.beneath?.[inv.seat]?.[source.id] || []
        return stored.some(code => cardTraitsFor(code)
          .some(trait => cardTraitsFor(context.enemy.originalCode || context.enemy.code).includes(trait)))
      }],
      resolve: ({ inv, source, context, api }) => {
        const enemy = context?.enemy
        if (!source || !enemy) return
        const attackingTraits = cardTraitsFor(enemy.originalCode || enemy.code)
        const stored = [...new Set(api.commitOrigins.beneath(inv.seat, source.id))]
        const candidates = stored.filter(code => cardTraitsFor(code).some(trait => attackingTraits.includes(trait)))
        if (!candidates.length) return
        const picked = candidates.length === 1 ? candidates[0] : api.choice({
          kind: 'card', source: '09089', seat: inv.seat,
          prompt: '选择要弃掉的罐底敌人（需与攻击敌人有相同特性）。',
          options: candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
        })
        if (!picked) return
        api.commitOrigins.take(inv.seat, source.id, picked, 'discard')
        api.addCardCounter(source, 'hollow', -1, { max: 2 })
        context.cancelled = true
        api.info(`🏺 「束敌宝罐」：弃掉罐底的「${api.cardName(picked)}」，取消这次攻击。`)
      },
    },
  ],
}
