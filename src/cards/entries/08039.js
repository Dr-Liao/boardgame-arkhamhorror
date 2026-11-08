// 08039 发掘古物
// 卡面：调查。选择你手中最多 2 张[seeker]支援。本次技能检定难度等于所选支援费用之和。
//       如果你成功，将所选支援依次放置入场。通过本能力每放置入场一张[[遗物]]支援，抽取 1 张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：从手牌里挑最多 2 张「seeker 阵营的支援」，难度 = 费用合计，用 api.startTest 发起智力检定；
// 成功后按选择顺序 api.putIntoPlay 依次入场，每张有 [[relic]] 特性的支援各抽 1 张。
const isSeekerAsset = (api, code) => api.cardType(code) === 'asset'
  && (api.cardFactions(code) || []).includes('seeker')
const isRelic = (api, code) => api.cardTraits(code).includes('relic')

export default {
  code: '08039',
  abilities: [
    {
      kind: 'played',
      label: '调查：选择至多 2 张[seeker]支援，难度=费用和；成功依次入场，每张遗物支援抽 1 张',
      resolve: ({ inv, api }) => {
        const candidates = [...new Set((inv.hand || []).filter(code => isSeekerAsset(api, code)))]
        const chosen = []
        while (chosen.length < 2 && candidates.length) {
          const answer = api.choice({
            kind: 'card', source: '08039', seat: inv.seat, canSkip: true,
            prompt: `发掘古物：选择要放置入场的[seeker]支援（已选 ${chosen.length}/2）。`,
            options: [
              { id: 'done', label: chosen.length ? '开始检定' : '取消' },
              ...candidates.map((code, index) => ({ id: String(index), cardCode: code, label: `${api.cardName(code)}（费用 ${api.cardCost?.(code) ?? 0}）` })),
            ],
          })
          if (answer === 'done' || answer == null) break
          const picked = candidates.splice(Number(answer), 1)[0]
          if (!picked) break
          chosen.push(picked)
        }
        if (!chosen.length) {
          api.info('发掘古物：没有选择任何支援。')
          return
        }
        const difficulty = chosen.reduce((sum, code) => sum + (Number(api.cardCost?.(code)) || 0), 0)
        api.startTest({
          seat: inv.seat, skill: 'intellect', difficulty, source: { label: '发掘古物', code: '08039' },
          resolve: result => {
            if (!result?.success) { api.info('发掘古物：检定失败，所选支援留在手中。'); return }
            let drawn = 0
            for (const code of chosen) {
              if (!inv.hand.includes(code)) continue
              if (api.putIntoPlay(inv.seat, code)) {
                if (isRelic(api, code)) drawn += 1
              }
            }
            if (drawn) api.drawCards(inv.seat, drawn)
            api.info(`发掘古物：将 ${chosen.length} 张支援依次放置入场${drawn ? `，其中遗物支援抽 ${drawn} 张` : ''}。`)
          },
        })
      },
    },
  ],
  modifiers: [],
}
