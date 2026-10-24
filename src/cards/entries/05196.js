// 05196 委员会的保险箱（中立 · 2 经验 · 独特）
// 卡面：使用(1[per_investigator]锁头)。如果委员会的保险箱上没有锁头，每位调查员查找自己的牌库或
//       弃牌堆，找出任意一张卡牌并立即将其免费打出。放逐委员会的保险箱。(每个剧本最多一次。)
// 卡面：[action][action]：检定任意一项技能(5)。如果你检定成功，移除1锁头。
//       你所在地点的任何调查员均可以激活本能力。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05196 委员会的保险箱：锁头 = 调查员人数；[行动][行动]检定任意技能(5)移除 1 锁头；
// 锁头清零后全队各免费打出 1 张任意卡，然后放逐自身。
//
// 显式简化：
//   · 「你所在地点的任何调查员均可以激活本能力」未接线——能力层按「支援控制者」枚举主动能力，
//     没有「同地点队友代为激活」的读点。单/多调查员下仍由控制者激活。
//   · 「每个剧本最多一次」依赖战役层放逐结算（state.exiledBySeat），本条目在场景内只做一次。

const SKILL_OPTIONS = [
  { id: 'willpower', label: '意志' },
  { id: 'intellect', label: '智慧' },
  { id: 'combat', label: '战斗' },
  { id: 'agility', label: '敏捷' },
]

export default {
  code: '05196',
  uses: 1,
  usesType: 'locks',
  simplified: true,
  note: '「你所在地点的任何调查员均可激活本能力」未实现（能力层只枚举控制者的主动能力）；'
    + '其余（按人数放置锁头、双行动检定任意技能移除锁头、无锁头时全队免费打出 1 张牌、放逐自身）已实现。',
  abilities: [
    {
      // 锁头数 = 每位调查员 1 个。
      kind: 'entersPlay',
      label: '入场：按调查员人数放置锁头',
      resolve: ({ state, source }) => {
        if (!source) return
        source.uses = Math.max(1, Number(state.numInvestigators) || 1)
        source.usesType = 'locks'
      },
    },
    {
      kind: 'action',
      label: '[行动][行动]：检定任意技能(5)，成功移除 1 锁头',
      // 双行动费用：能力层没有 number 型的 action 费用。引擎先按 action 费用扣 1 点，
      // resolve 里检查「还有没有第 2 点」：有就再扣 1 点；没有就把引擎扣的那点退回去
      // （能力当次不结算，避免出现「付了 1 点却什么都没发生」的静默扣费）。
      cost: { action: true },
      resolve: ({ state, inv, source, api }) => {
        if ((inv.actionsLeft ?? 0) < 1) {
          api.gainAction(inv.seat, 1)
          api.info('「委员会的保险箱」需要 2 个行动点才能启动。')
          return
        }
        api.gainAction(inv.seat, -1)
        const skill = api.choice({
          kind: 'skill', source: '05196', seat: inv.seat,
          prompt: '选择本次检定使用的技能。', options: SKILL_OPTIONS,
        })
        const chosenSkill = SKILL_OPTIONS.some(option => option.id === skill) ? skill : 'willpower'
        const result = api.test(inv.seat, chosenSkill, 5, {
          source: { label: '保险箱', name: '委员会的保险箱', code: '05196' },
        })
        if (!result?.success) {
          api.info(`🔒 ${inv.name} 没能打开「委员会的保险箱」，锁头没有减少。`)
          return
        }
        api.setAssetUses(source, Math.max(0, (source.uses || 0) - 1))
        api.info(`🔓 移除 1 个锁头（剩余 ${source.uses || 0}）。`)
        if ((source.uses || 0) > 0) return
        // 没有锁头：每位调查员查找自己的牌库或弃牌堆，找出任意一张卡牌并立即免费打出。
        for (const owner of state.investigators.filter(item => !item.defeated && !item.resigned)) {
          searchAndPlayForFree(owner, api)
        }
        // 放逐自身：与引擎 exilePlayerCard 同一记账口径（战役层读 state.exiled / exiledBySeat）。
        api.discardAsset(inv.seat, source)
        state.exiled.push('05196')
        state.exiledBySeat ||= []
        state.exiledBySeat.push({ seat: inv.seat, code: '05196' })
        api.info('「委员会的保险箱」被放逐。')
      },
    },
  ],
}

// 该调查员从自己的牌库或弃牌堆中选出任意一张非弱点卡牌，免费打出。
function searchAndPlayForFree(owner, api) {
  const candidates = []
  for (const code of owner.deck || []) {
    if (!api.isNonWeakness(code)) continue
    if (candidates.some(item => item.code === code && item.from === 'deck')) continue
    candidates.push({ code, from: 'deck' })
  }
  for (const code of owner.discard || []) {
    if (!api.isNonWeakness(code)) continue
    if (candidates.some(item => item.code === code && item.from === 'discard')) continue
    candidates.push({ code, from: 'discard' })
  }
  if (!candidates.length) return
  const picked = candidates.length === 1 ? 0 : Number(api.choice({
    kind: 'card', source: '05196', seat: owner.seat,
    prompt: `${owner.name} 从自己的牌库或弃牌堆中找出任意一张卡牌，并免费打出。`,
    options: candidates.map((item, index) => ({
      id: String(index),
      label: `${api.cardName(item.code)}（${item.from === 'deck' ? '牌库' : '弃牌堆'}）`,
    })),
  }))
  const item = candidates[picked] || candidates[0]
  if (!item) return
  api.moveCard({ code: item.code, from: item.from, to: 'hand', ownerSeat: owner.seat })
  api.playCard(owner.seat, item.code, { discount: 99, noAction: true })
}
