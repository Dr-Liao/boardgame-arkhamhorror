// 10725 异星低语（Alien Whispers）· 诡计 · 共享遭遇组 agents_of_the_colour（印刷 2 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/agents_of_the_colour。
// 卡面（cards-data 10725）：
//   显现 - 检定[意志](3)。你检定失败且每低于难度 1 点，你必须（选择一项）：
//   - 受到 1 点伤害，只能分配给你控制的支援。
//   - 受到 1 点恐惧，只能分配给你控制的支援。
//   - 随机弃掉你 1 张手牌。
//
// 读点（声明即接线）：显现直接在本条目结算（treachery-tokens.js#resolveTreacheryBody 的
//   entryRevelation 分支调用 encounterResolve，api = scenarioRuntime）。
//   每失败 1 点用 api.choice 逐点询问；「只能分配给支援」按候选资产的印刷生命/神智过滤，
//   再走 api.damageAsset / api.horrorAsset（scenario-runtime 的逐资产伤害/恐惧入口）；
//   「随机弃牌」走 api.discardRandom（deck-ops 的随机弃手牌管线）。
import { ALL_CARDS } from '../../../_shared.js'

const CODE = '10725'
const SKILL = 'willpower'
const DIFFICULTY = 3

const canTake = (asset, kind) => {
  const definition = ALL_CARDS[asset?.code]
  if (!definition) return false
  return kind === 'damage' ? (Number(definition.health) || 0) > 0 : (Number(definition.sanity) || 0) > 0
}

function chooseAsset(state, inv, kind, api) {
  const options = (inv.assets || []).filter(asset => canTake(asset, kind))
  if (!options.length) return null
  if (options.length === 1) return options[0]
  const answer = String(api.choice({
    kind: 'asset', source: CODE, seat: inv.seat,
    prompt: kind === 'damage' ? '选择承受 1 点伤害的支援。' : '选择承受 1 点恐惧的支援。',
    options: options.map(asset => ({ id: asset.id, label: api.cardName?.(asset.code) || asset.code, cardCode: asset.code })),
  }))
  return options.find(asset => String(asset.id) === answer) || options[0]
}

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  flags: {
    traits: ['Power', 'Colour'],
    quantity: 2,
    test: { skill: SKILL, difficulty: DIFFICULTY },
    failByChoicePerPoint: ['assetDamage', 'assetHorror', 'discardRandom'],
  },
  encounterResolve(state, inv, card, api) {
    const seat = inv?.seat
    if (!Number.isInteger(seat)) return false
    api.test(seat, SKILL, DIFFICULTY, result => {
      if (result?.success) {
        api.info?.(`✔️ ${inv.name} 通过「异星低语」检定（意志 ${result.value} vs ${DIFFICULTY}）。`)
        return
      }
      const failedBy = Math.max(0, Number(result?.difficulty ?? DIFFICULTY) - Number(result?.value ?? 0))
      for (let index = 0; index < failedBy; index += 1) {
        const owner = state?.investigators?.[seat]
        if (!owner || owner.defeated || owner.resigned) return
        const options = []
        if ((owner.assets || []).some(asset => canTake(asset, 'damage'))) {
          options.push({ id: 'damage', label: '受到 1 点伤害（只能分配给支援）' })
        }
        if ((owner.assets || []).some(asset => canTake(asset, 'horror'))) {
          options.push({ id: 'horror', label: '受到 1 点恐惧（只能分配给支援）' })
        }
        if ((owner.hand || []).length) options.push({ id: 'discard', label: '随机弃掉 1 张手牌' })
        if (!options.length) return
        const answer = options.length === 1
          ? options[0].id
          : String(api.choice({
            kind: 'effect', source: CODE, seat,
            prompt: `「异星低语」：选择一项（剩余 ${failedBy - index} 次）。`, options,
          }))
        if (answer === 'damage') {
          const asset = chooseAsset(state, owner, 'damage', api)
          if (asset) {
            api.damageAsset(seat, asset.id, 1)
            api.info?.(`👽 「异星低语」：${inv.name} 的「${api.cardName?.(asset.code) || asset.code}」受到 1 点伤害。`)
          }
        } else if (answer === 'horror') {
          const asset = chooseAsset(state, owner, 'horror', api)
          if (asset) {
            api.horrorAsset(seat, asset.id, 1)
            api.info?.(`👽 「异星低语」：${inv.name} 的「${api.cardName?.(asset.code) || asset.code}」受到 1 点恐惧。`)
          }
        } else {
          api.discardRandom(seat, 1)
          api.info?.(`👽 「异星低语」：${inv.name} 随机弃掉 1 张手牌。`)
        }
      }
    }, 0, { code: CODE, label: '遭遇检定', name: '异星低语' })
    // false = 显现结算完成后由引擎把本卡放进遭遇弃牌堆。
    return false
  },
  note: '显现自足实现（逐失败点二选一/三选一）；「只能分配给支援」按资产印刷生命/神智过滤后'
    + '走 damageAsset/horrorAsset；这两个入口直接落伤害/恐惧，不走调查员的伤害分配窗口'
    + '（支援侧的「受到伤害后」反应仍由引擎在资产伤害结算内处理）。没有可分配支援时该选项不出现。',
}
