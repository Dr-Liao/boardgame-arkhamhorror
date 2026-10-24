// 05231 知识就是力量（探求者 · 0 经验）
// 卡面：快速。只能在你回合期间打出。
// 卡面：选择一张你控制的[[书籍]]或[[法术]]支援，或揭示你手牌中的一张[[书籍]]或[[法术]]支援。
//       结算该支援上的一个[action]或[fast]能力，忽略所有费用(包括其[action]费用，如有)。
//       然后，如果该支援是从你手牌中揭示的，你可以弃掉它来抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05231 知识就是力量：结算一张[[书籍]]/[[法术]]支援上的一个 [行动]/[快速] 能力（忽略费用）。
//
// 显式简化（详见 worker 报告）：
//   未实现：「忽略所有费用」由引擎费用管线统一执行（payAbilityCost / descriptorCost / 每回合上限记账）。
//   本批用单卡 resolve 直接调用所选支援首个 action/free 描述子的 resolve() —— 效果本身结算正确、
//   也不付费用，但不会走引擎的费用校验/上限记账，且只覆盖用 resolve 实现的描述子（纯 effect 数据体
//   的能力无法从卡文件里再解释一遍）。需要 target 声明才能用的能力会被跳过。
//   proposedApi: resolveCardAbility(assetOrCode, { abilityIndex, ignoreCosts: true })；
//   见 artifacts/migration/tcu/primitive-requests/w-m2-3-05231-resolve-card-ability.json。P10 前补；
//   注：这里不写 `api.` 前缀——tests/p0-regressions 的能力 API 覆盖用例会扫描条目源码里的 api.* 调用，
//   未实现的建议 API 写成字面量会被误判为「调用了不存在的 ctx.api 方法」。

import { ownTurn } from '../../engine/matcher.js'
import { entryData } from './_shared.js'

const isTomeOrSpell = (api, code) => {
  if (api.cardType(code) !== 'asset') return false
  const traits = api.cardTraits(code) || []
  return traits.some(trait => ['tome', 'spell'].includes(String(trait).toLowerCase()))
}

// 可以从卡文件里直接结算的能力：action/free + 有 resolve + 不需要引擎注入 target。
const executableDescriptors = code => (entryData(code, 'abilities') || [])
  .filter(descriptor => (descriptor.kind === 'action' || descriptor.kind === 'free')
    && typeof descriptor.resolve === 'function' && !descriptor.target)

export default {
  code: '05231',
  simplified: true,
  note: '未实现：「忽略所有费用」的引擎费用管线执行（费用校验/上限记账）——改为直接调用所选支援首个 action/free'
    + ' 描述子的 resolve（效果结算正确、不付费用，但不走引擎费用/上限，且只覆盖 resolve 型能力）；'
    + '其余（选择场上或手牌的书籍/法术支援、手牌支援弃掉抽 1）已实现。'
    + ' 需要通用原语 resolveCardAbility(code, { abilityIndex, ignoreCosts })（未实现的建议 API，不写 api. 前缀）；P10 前补。',
  playCondition: [ownTurn()],
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '知识就是力量：结算一张书籍/法术支援的 [行动]/[快速] 能力（忽略费用）',
      resolve: ({ state, inv, api, events }) => {
        const controlled = inv.assets
          .filter(asset => isTomeOrSpell(api, asset.code) && executableDescriptors(asset.code).length)
          .map(asset => ({ kind: 'asset', code: asset.code, asset }))
        const fromHand = [...new Set(inv.hand)]
          .filter(code => isTomeOrSpell(api, code) && executableDescriptors(code).length)
          .map(code => ({ kind: 'hand', code, asset: null }))
        const candidates = [...controlled, ...fromHand]
        if (!candidates.length) { api.info('没有可以结算能力的[[书籍]]或[[法术]]支援。'); return }
        const answer = candidates.length === 1 ? '0' : api.choice({
          kind: 'target', source: '05231', seat: inv.seat,
          prompt: '选择一张[[书籍]]或[[法术]]支援，结算它的一个[行动]或[快速]能力。',
          options: candidates.map((candidate, index) => ({
            id: String(index),
            label: `${api.cardName(candidate.code)}（${candidate.kind === 'asset' ? '场上' : '手牌'}）`,
          })),
        })
        const picked = candidates[Number(answer)] || candidates[0]
        const list = executableDescriptors(picked.code)
        const pickedIndex = list.length === 1 ? 0 : Number(api.choice({
          kind: 'effect', source: '05231', seat: inv.seat,
          prompt: '选择要结算的能力。',
          options: list.map((descriptor, index) => ({ id: String(index), label: descriptor.label })),
        }))
        const descriptor = list[pickedIndex] || list[0]
        const source = picked.kind === 'asset'
          ? picked.asset
          : { id: `hand:${picked.code}`, code: picked.code, exhausted: false, uses: null }
        if (picked.kind === 'hand') {
          api.info(`📖 ${inv.name} 从手牌揭示「${api.cardName(picked.code)}」。`)
        }
        api.info(`📖 「知识就是力量」结算「${api.cardName(picked.code)}」的能力：${descriptor.label}（忽略费用）。`)
        descriptor.resolve({
          state, seat: inv.seat, inv, source, descriptor,
          context: {}, events, targetId: null, target: null, api,
        })
        if (picked.kind !== 'hand') return
        const discardIt = api.choice({
          kind: 'effect', source: '05231', seat: inv.seat, canSkip: true,
          prompt: '是否弃掉这张从手牌揭示的支援，以抽取 1 张卡牌？',
          options: [{ id: 'skip', label: '保留' }, { id: 'discard', label: '弃掉并抽 1 张' }],
        })
        if (discardIt !== 'discard') return
        api.discardFromHand(inv.seat, picked.code)
        api.drawCards(inv.seat, 1)
        api.info(`🃏 ${inv.name} 弃掉「${api.cardName(picked.code)}」并抽取 1 张牌。`)
      },
    },
  ],
}
