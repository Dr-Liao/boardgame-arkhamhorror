// 09040 炼金蒸馏（Alchemical Distillation）· 探求者资产 · 手槽 · 使用(3 补给) · 定制。
// 卡面：定制。使用(3 补给)。
//       [action] 花费 1 补给：选择你所在地点的一位调查员并检定[intellect](1)。如果你检定成功，
//       该调查员执行下列一个选项 —— 抽取 2 张卡牌 / 获得 2 资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 定制实现（勾选面板契约 + 已勾选项的运行时效果）：
//   · Mending/Calming/Enlightening/Quickening 四项各追加一个可选效果；
//   · Refined：入场时 +2 补给（entersPlay + api.addUses）；
//   · Empowered：发起检定时可选择难度 +2，本次每个效果值 +1；
//   · Perfected：成功超过难度 ≥2 时可执行两个不同选项。
// 未实现：Enlightening 的「充能或秘密」二选一按充能处理（api.addUses(asset,1)），见 note。
import { customizationChecked } from '../../engine/tsk-customizable.js'

const SOURCE = '09040'
const MAX_SUPPLIES = 3
const checked = (state, seat) => customizationChecked(state, seat, SOURCE)

export default {
  code: '09040',
  uses: MAX_SUPPLIES,
  usesType: 'supplies',
  note: 'approximation: Enlightening 的「充能或秘密」按充能结算（api.addUses(asset,1)），秘密类支援不区分标记类型',
  customizationOptions: [
    { name: 'Mending Distillate', checks: 1, text: 'Add this option: "- Heal 2 damage."' },
    { name: 'Calming Distillate', checks: 1, text: 'Add this option: "- Heal 2 horror."' },
    { name: 'Enlightening Distillate', checks: 1, text: 'Add this option: "- Place 1 charge or secret on an asset you control."' },
    { name: 'Quickening Distillate', checks: 1, text: 'Add this option: "- Move up to 2 times."' },
    { name: 'Refined', checks: 2, text: 'Alchemical Distillation enters play with 2 additional supplies on it.' },
    { name: 'Empowered', checks: 4, text: 'When you initiate this skill test, you may increase its difficulty by 2. If you do, increase the value of the effect granted by each option by 1 for this test.' },
    { name: 'Perfected', checks: 5, text: 'If you succeed by 2 or more, the chosen investigator may perform two different options instead of one.' },
  ],
  abilities: [
    {
      kind: 'entersPlay',
      label: '精炼（Refined）：入场时额外 2 补给',
      resolve: ({ state, inv, source, api }) => {
        if (!source) return
        if (!checked(state, inv.seat).includes(4)) return
        api.addUses(source, 2)
        api.info(`炼金蒸馏：精炼入场，补给 ${source.uses}/${MAX_SUPPLIES + 2}。`)
      },
    },
    {
      kind: 'action',
      label: '花 1 补给：检定[智力](1)，成功让一位调查员执行一个选项',
      cost: { action: true, uses: 1 },
      resolve: ({ state, inv, source, api }) => {
        const candidates = api.investigatorsAt(inv.location)
        if (!candidates.length) {
          api.info('炼金蒸馏：这里没有调查员。')
          return
        }
        const seat = candidates.length === 1 ? candidates[0].seat : Number(api.choice({
          kind: 'investigator', source: SOURCE, seat: inv.seat,
          prompt: '炼金蒸馏：选择要服用蒸馏液的调查员。',
          options: candidates.map(other => ({ id: String(other.seat), label: other.name })),
        }))
        const target = state.investigators[seat]
        if (!target) return
        const picked = checked(state, inv.seat)
        let difficulty = 1
        let valueBonus = 0
        if (picked.includes(5)) {
          const answer = api.choice({
            kind: 'effect', source: SOURCE, seat: inv.seat,
            prompt: '炼金蒸馏（注能）：是否把本次检定难度 +2，让每个选项的效果值 +1？',
            options: [{ id: 'empower', label: '难度 +2，效果 +1' }, { id: 'normal', label: '按印刷难度' }],
          })
          if (answer === 'empower') {
            difficulty += 2
            valueBonus = 1
          }
        }
        const runOption = () => {
          const options = [
            { id: 'draw', label: `抽取 ${2 + valueBonus} 张卡牌` },
            { id: 'resources', label: `获得 ${2 + valueBonus} 资源` },
          ]
          if (picked.includes(0)) options.push({ id: 'healDamage', label: `治愈 ${2 + valueBonus} 点伤害` })
          if (picked.includes(1)) options.push({ id: 'healHorror', label: `治愈 ${2 + valueBonus} 点恐惧` })
          if (picked.includes(2)) options.push({ id: 'charge', label: '在你控制的支援上放置 1 充能' })
          if (picked.includes(3)) options.push({ id: 'move', label: '移动最多 2 次' })
          const pick = api.choice({
            kind: 'effect', source: SOURCE, seat: inv.seat,
            prompt: '炼金蒸馏：选择一个效果。', options,
          })
          const amount = 2 + valueBonus
          if (pick === 'draw') api.drawCards(seat, amount)
          else if (pick === 'resources') api.gainResources(seat, amount)
          else if (pick === 'healDamage') api.healDamage(seat, amount, { log: true })
          else if (pick === 'healHorror') api.healHorror(seat, amount, { log: true })
          else if (pick === 'charge') {
            const chargers = (inv.assets || []).filter(card => card.uses != null)
            if (chargers.length) {
              const assetId = chargers.length === 1 ? chargers[0].id : api.choice({
                kind: 'asset', source: SOURCE, seat: inv.seat,
                prompt: '炼金蒸馏：选择放置充能的支援。',
                options: chargers.map(card => ({ id: card.id, label: api.cardName(card.code) })),
              })
              const host = chargers.find(card => card.id === assetId) || chargers[0]
              api.addUses(host, 1)
              api.info(`炼金蒸馏：给「${api.cardName(host.code)}」放置 1 充能。`)
            }
          } else if (pick === 'move') {
            for (let step = 0; step < 2; step++) {
              if (!api.moveDestinations(inv.seat).length) break
              const destination = api.choice({
                kind: 'location', source: SOURCE, seat: inv.seat,
                prompt: `炼金蒸馏：移动（${step + 1}/2），选择目的地或停止。`,
                options: [{ id: 'stop', label: '停止移动' },
                  ...api.moveDestinations(inv.seat).map(id => ({ id, label: api.locName(id) }))],
              })
              if (destination === 'stop' || !destination) break
              api.moveInvestigator(inv.seat, destination)
            }
          }
          return pick
        }
        api.startTest({
          seat: inv.seat, skill: 'intellect', difficulty,
          source: { label: '炼金蒸馏', code: SOURCE },
          resolve: result => {
            if (!result?.success) return
            const first = runOption()
            if (!first) return
            if (!picked.includes(6)) return
            if ((result.value - result.difficulty) < 2) return
            const second = api.choice({
              kind: 'effect', source: SOURCE, seat: inv.seat,
              prompt: '炼金蒸馏（至纯）：成功超过 2 点，可以再执行一个不同选项？',
              options: [{ id: 'skip', label: '不再执行' }, { id: 'again', label: '再执行一个不同选项' }],
            })
            if (second === 'again') runOption()
          },
        })
      },
    },
  ],
  modifiers: [],
}
