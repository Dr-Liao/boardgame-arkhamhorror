// 09058 格雷氏解剖学（Gray's Anatomy）· 探寻者（Seeker）资产 · 5 经验 · 道具 · 典籍 · 手部。
//
// 卡面：[action]：选择你所在地点的一张卡牌并检定[智力](1)。你检定成功且每超过难度 1 点，选择一项——
//       - 该卡牌本轮下一次将要被治愈时，治愈的伤害/恐惧 +1（最多 +3）。
//       - 该卡牌本轮下一次将要受到伤害时，受到的伤害 +1（最多 +3）。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 选择「你所在地点的一张卡牌」+ 检定[智力](1) → api.choice（调查员与同地点支援的统一候选）+
//     api.test 的结果契约（B3：result.successBy）。
//   · 每点成功的选择 → api.choice 逐次询问，最多 +3。
// 本轮效果按目标实体和伤害或治疗类型保存，在下一次对应结算后移除。
const CODE = '09058'

const describeTarget = (item, api) => item.kind !== 'asset'
  ? item.label
  : `${api.cardName(item.code)}（${api.cardName(item.ownerCode)}）`

export default {
  code: CODE,
  abilities: [
    {
      kind: 'action',
      cost: { action: true },
      label: '选择同地点一张卡牌并检定[智力](1)：每超 1 点选择「下一治疗 +1」或「下一伤害 +1」（最多 +3）',
      resolve: ({ inv, api }) => {
        const candidates = []
        for (const other of api.investigatorsAt(inv.location)) {
          candidates.push({ id: `seat:${other.seat}`, kind: 'investigator', label: other.name, code: other.code, ownerCode: other.code })
          for (const asset of other.assets || []) {
            candidates.push({ id: `asset:${asset.id}`, kind: 'asset', label: api.cardName(asset.code), code: asset.code, ownerCode: other.code })
          }
        }
        for (const enemy of api.enemiesAt(inv.location)) {
          candidates.push({ id: `enemy:${enemy.id}`, kind: 'enemy', label: enemy.name, code: enemy.originalCode || enemy.code })
        }
        if (!candidates.length) {
          api.info('「格雷氏解剖学」：你所在地点没有可以指定的卡牌。')
          return
        }
        const picked = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '「格雷氏解剖学」：选择你所在地点的一张卡牌。',
          options: candidates.map(item => ({ id: item.id, label: item.label, cardCode: item.code })),
        })
        const target = candidates.find(item => item.id === picked) || candidates[0]
        api.test(inv.seat, 'intellect', 1, {
          source: { code: CODE, label: '格雷氏解剖学', name: '格雷氏解剖学' },
          resolve: result => {
            if (!result.success) return
            const successBy = Number(result.summary?.successBy ?? result.successBy
              ?? (Number(result.value) - Number(result.difficulty)))
            const times = Math.min(3, Math.max(0, Number.isFinite(successBy) ? successBy : 0))
            for (let index = 0; index < times; index++) {
              const answer = api.choice({
                kind: 'effect', source: CODE, seat: inv.seat,
                prompt: `「格雷氏解剖学」：为「${describeTarget(target, api)}」选择第 ${index + 1} 项效果（最多 +3）。`,
                options: [
                  { id: 'heal', label: '本轮下一次被治愈时，治愈的伤害/恐惧 +1' },
                  { id: 'damage', label: '本轮下一次受到伤害时，受到的伤害 +1' },
                ],
              })
              const kind = answer === 'damage' ? 'damage' : 'heal'
              api.addEffect({
                duration: 'endOfRound', sourceCode: CODE, controllerSeat: inv.seat,
                harmBonus: { targetId: target.kind === 'investigator' ? target.id : target.id.slice(target.kind.length + 1), kind, amount: 1 },
                label: `「${describeTarget(target, api)}」本轮下一次${kind === 'heal' ? '被治愈时治愈 +1' : '受到伤害时伤害 +1'}`,
              })
            }
            api.info(`📖 「格雷氏解剖学」：为「${describeTarget(target, api)}」记录了 ${times} 项效果（最多 +3）。`)
          },
        })
      },
    },
  ],
  modifiers: [],
}
