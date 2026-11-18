// 10037 旋风连击（Flurry of Blows）· 守护者事件 · 5 经验 · 2 资源 · 战术/Double/命定
// 卡面：你控制[[近战]]支援才能打出。作为打出旋风连击的额外费用，花费一个行动。
//       攻击。选择一个你控制的[[近战]]支援，使用该支援立即进行一次攻击行动（不支付其[action]费用）。
//       你可以再重复此效果最多三次。最后一次攻击结算后，如果这是你的回合，结束你的回合。
//
// 读点（卡面 → 引擎）：
//   · 「Double：作为额外费用花费一个行动」= played 描述子 cost: { action: 1 }；
//     读点 actions.js#doPlay（playedExtraAction：行动不足时直接拒绝开始结算，结算后 consumeAction）。
//   · 卡面「攻击。」= played 描述子 countsAs:'fight'（读点 table-decisions.js#actionKind 的 played
//     分支：按攻击行动结算 → 不引发借机攻击；同时满足 tests/card-entries.test.mjs 的豁免守卫）。
//   · 「你控制[[近战]]支援才能打出」= playCondition 谓词（读实例/卡面特性 + 该支援是否有
//     countsAs/actionKind = fight 的[action]能力；没有可执行攻击的[[近战]]支援不算）。
//   · 「使用该支援立即进行一次攻击行动（不付[action]费用），最多重复三次」=
//     api.resolveAssetAction(seat, { assetId, abilityIndex, waive:'action' })：与牌桌按钮同一个
//     resolveCardAbility 管线（ignoreActionCost 只免行动费，其余费用照付）。重复由玩家逐次选择
//     （每次拒绝即结束），引擎的嵌套检索/目标选择仍走真实能力执行。
//   · 「最后一次攻击结算后，如果这是你的回合，结束你的回合」= api.endTurn(seat)（唯一结束回合入口，
//     04233/04269 同口径；不是本回合则不调用）。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '10037'
const MAX_ATTACKS = 4

// 在 resolve 内经 api.cardAbilityOptions 读取该支援的可执行 action 能力（与牌桌按钮同一读点；
// 卡文件不 import 引擎装配点）。返回 fight 能力的 abilityIndex，没有则 -1。
function fightAbilityIndex(api, asset) {
  const options = api.cardAbilityOptions(asset.controllerSeat ?? asset.ownerSeat ?? 0, asset, { ignoreCosts: true }) || []
  const fight = options.find(option => option.index != null && /攻击|战斗|fight/i.test(String(option.label || '')))
  return fight ? fight.index : -1
}

function isMelee(asset) {
  const traits = [...(asset?.traits || []), ...(ALL_CARDS[asset?.code]?.traits || [])]
  return traits.some(trait => String(trait).toLowerCase() === 'melee')
}

function usableMeleeAssets(api, inv) {
  return (inv.assets || []).filter(asset => isMelee(asset) && fightAbilityIndex(api, asset) >= 0)
}

function repeatableFight({ state, inv, api }) {
  const candidates = usableMeleeAssets(api, inv)
  if (!candidates.length) {
    api.info('旋风连击：你没有可执行攻击行动的[[近战]]支援。')
    return
  }
  const assetId = candidates.length === 1 ? candidates[0].id : api.choice({
    kind: 'asset', source: CODE, seat: inv.seat,
    prompt: '旋风连击：选择要使用其攻击行动的[[近战]]支援。',
    options: candidates.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })),
  })
  const asset = candidates.find(item => item.id === assetId) || candidates[0]
  const abilityIndex = fightAbilityIndex(api, asset)
  let attacks = 0
  while (attacks < MAX_ATTACKS) {
    const done = api.resolveAssetAction(inv.seat, { assetId: asset.id, abilityIndex, waive: 'action' })
    if (!done) break
    attacks += 1
    api.info(`🌪 旋风连击：使用「${api.cardName(asset.code)}」进行第 ${attacks} 次攻击。`)
    if (attacks >= MAX_ATTACKS) break
    const answer = api.choice({
      kind: 'effect', source: CODE, seat: inv.seat,
      prompt: `旋风连击：已进行 ${attacks} 次攻击，是否再重复一次（最多 4 次）？`,
      options: [{ id: 'done', label: '结束' }, { id: 'repeat', label: '再攻击一次' }],
    })
    if (answer !== 'repeat') break
  }
  if (state.currentSeat === inv.seat) {
    api.info('🌪 旋风连击：最后一次攻击结算后结束回合。')
    api.endTurn(inv.seat)
  }
}

export default {
  code: CODE,
  name: 'Flurry of Blows',
  playCondition: [{
    when: ({ inv }) => (inv.assets || []).some(isMelee),
    message: '你控制可执行攻击行动的[[近战]]支援才能打出（能力可用性在结算时校验）',
  }],
  abilities: [
    {
      kind: 'played',
      countsAs: 'fight',
      cost: { action: 1 },
      label: '使用一个[[近战]]支援立即攻击，最多 4 次；之后结束本回合',
      resolve: repeatableFight,
    },
  ],
  modifiers: [],
}
