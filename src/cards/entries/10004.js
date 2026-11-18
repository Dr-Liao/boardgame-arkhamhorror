// 10004 凯特·温斯罗普（Kate Winthrop）· 探求者 · 科学家
// 卡面：
//   你以磁通量稳定器（关闭）面朝上开始游戏。
//   [fast]：将 1 个线索从凯特·温斯罗普移动到一个你控制的没有线索的 [[科学]] 或 [[工具]] 支援上。
//   强制 - 在你控制的有线索的支援离场时：将其线索放到你所在地点。
//   [elder_sign] 效果：+0。你可以从自己控制的支援上将 1 个线索移动回凯特·温斯罗普。
//
// 读点（卡面 → 引擎读点）：
//   · 开局「磁通量稳定器（关闭）面朝上」：条目 `investigator.startsWith = ['10005']`，
//     setup.js#prepareInvestigator 把签名卡从牌库移入支援区（同 09015 / 06004 的口径）。
//   · [fast]：`investigator.freeAction`（moves.js#legalMoves 的免费行动读点，09008 同形）；
//     卡面没有每回合次数限制，因此 `repeatable: true`，`cost.action = false`。
//   · 线索移动：`api.transferControlledClues`（P2 原语，`{ emptyTarget: true }` 校验目标无线索、
//     归属与容量，并把 `returnCluesOnLeave` 写到目标支援上）。
//     候选特质由卡侧用 `api.countControlled({ trait })` 过滤（读点 cardHasTrait：印刷特性 +
//     运行期 `add:trait` 授予）。这里不把 `traits` 传给原语：原语的 traits 选项读的是**实例**
//     asset.traits，而真实支援实例不带 traits 字段（newPlayerAssetInstance 只写身份/使用次数），
//     传了会把所有真实支援都判成不匹配——已在汇报里列为 P2 原语缺口。
//   · 强制「有线索的支援离场 → 线索放到你的地点」：引擎统一读点
//     assets.js#leaveAsset → asset-clues.js#returnAssetClues（线索经 transferControlledClues
//     放置时置 returnCluesOnLeave=true，离场自动归还所在地点）。这条强制对所有调查员同一口径，
//     条目不再重复声明 forced（否则会双倍放置）；回归见 tests/fhv-investigator-10004.test.mjs。
//   · 旧印：`elderSign.resolve` 返回 delta 0；若你有带线索的受控支援，选 1 张移 1 个线索回凯特
//     （多于 1 张时 api.choice；没有则纯 +0）。
const CLUE_TRAITS = ['science', 'tool']

function clueTargets(inv, api) {
  const merged = []
  for (const trait of CLUE_TRAITS) merged.push(...api.countControlled(inv.seat, { trait }))
  const seen = new Set()
  const targets = []
  for (const card of merged) {
    if (!card || seen.has(card.id)) continue
    seen.add(card.id)
    if (!(inv.assets || []).includes(card)) continue // 只允许支援，不含威胁区
    if ((Number(card.clues) || 0) > 0) continue
    targets.push(card)
  }
  return targets
}

function clueSources(inv) {
  return (inv.assets || []).filter(card => (Number(card.clues) || 0) > 0)
}

export default {
  code: '10004',
  name: '凯特·温斯罗普',
  kind: 'investigator',
  note: '缺口：P2 原语 transferControlledClues 的 traits 选项读实例 asset.traits，真实支援实例不带该字段；本卡改用 api.countControlled 过滤[[科学]]/[[工具]]后只向原语传 emptyTarget。',
  investigator: {
    elderSign: { bonus: 0 },
    startsWith: ['10005'],
    freeAction: {
      id: 'kateWinthropFastClue',
      label: '⚡ [fast] 将 1 个线索从凯特移到一个没有线索的 [[科学]] 或 [[工具]] 支援上',
      cost: { action: false },
      repeatable: true,
      resolve: ({ inv, api }) => {
        const targets = clueTargets(inv, api)
        if (!targets.length) {
          api.info('凯特：没有可接收线索的[[科学]]或[[工具]]支援。')
          return
        }
        const target = targets.length === 1 ? targets[0] : targets.find(card => card.id === api.choice({
          kind: 'target', source: '10004', seat: inv.seat,
          prompt: '选择接收线索的[[科学]]或[[工具]]支援（须没有线索）。',
          options: targets.map(card => ({ id: card.id, label: api.cardName(card.code) })),
        })) || targets[0]
        if (!target) return
        const moved = api.transferControlledClues(inv.seat, 'investigator', target.id, 1, { emptyTarget: true })
        if (moved) api.info(`⚡ 凯特把 1 个线索移到「${api.cardName(target.code)}」。`)
      },
    },
  },
  elderSign: {
    id: '10004-eldersign',
    label: '凯特旧印：+0；你可以从自己控制的支援上移 1 个线索回凯特',
    resolve: ({ inv, api }) => {
      const sources = clueSources(inv)
      if (sources.length) {
        const source = sources.length === 1 ? sources[0] : sources[Number(api.choice({
          kind: 'target', source: '10004', seat: inv.seat,
          prompt: '选择要移回 1 个线索的支援。',
          options: sources.map((card, index) => ({ id: String(index), label: api.cardName(card.code) })),
        }))]
        if (source) {
          const moved = api.transferControlledClues(inv.seat, source.id, 'investigator', 1)
          if (moved) api.info(`🔬 凯特从「${api.cardName(source.code)}」取回 1 个线索。`)
        }
      }
      return { delta: 0 }
    },
  },
  abilities: [],
  modifiers: [],
}
