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
// approximation: 引擎没有「下一治疗/受伤 +N」的读点（harm-threat 只有限定在本次结算内的
//   healDamageFrom / extendHealHorror）。这里把每次选择写成一条 endOfRound 的持续效果记录
//   （state.effects，随存档往返、按统一过期点清理），真正的读点见
//   artifacts/migration/tsk/primitive-requests/09058.json（new.nextHealBonus / new.nextDamageBonus）。
//   测试断言近似后的真实行为：检定成功点数 = 询问次数、上限 +3、记录带当选卡号与 endOfRound。
const CODE = '09058'

const describeTarget = (item, api) => item.kind === 'investigator'
  ? item.label
  : `${api.cardName(item.code)}（${api.cardName(item.ownerCode)}）`

export default {
  code: CODE,
  simplified: true,
  note: 'approximation: 逐点选择 + 本轮持续记录由条目实现；「下一治疗/受伤 +N」的伤害管线读点见 primitive-requests/09058.json。',
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
