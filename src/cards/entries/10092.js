// 10092 邪恶祭祀刀（Wicked Athame）· 潜修者支援 · 2 资源 · 手部 · 道具/武器/近战/诅咒
// 卡面：
//   [action] 在混乱袋中加入 1-3 个[curse]标记：攻击。每加入 1 个[curse]标记作为本行动的费用，
//   你本次攻击得到 +2[combat]。如果本次攻击击败了敌人，补满你控制的支援上的 1 充能或 1 贡品。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 「加入 1-3 个诅咒作为费用」：描述子的 additionalTokenCost（token-cost.js 的唯一标记费用读点，
//     07023/07028/07307 同款）只能写固定值，因此声明最低 1 个（引擎在付费用时加入、付不起时不放行），
//     额外的 0-2 个在 resolve 里用 api.chaosTokens.add('curse', n, { exact: true }) 补足。
//   · 「攻击。」→ countsAs: 'fight'（actionKind 读点：不引发借机攻击，卡面行动指示门禁也读它）。
//   · 攻击：api.fight（combat.js#doFight 的同一份管线；assetId/sourceCode/combatBonus 与 09113 同款）。
// 击败采用攻击结果；只有印刷使用量尚未补满的受控支援才可入选。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '10092'

const refillableTypes = new Set(['charge', 'charges', 'offering', 'offerings'])

const printedMaximum = asset => {
  const uses = /Uses\s*\((\d+) (?:charges?|offerings?)\)/i.exec(ALL_CARDS[asset.code]?.text || '')
  return Number(uses?.[1] || 0)
}
const refillableAssets = inv => (inv.assets || [])
  .filter(asset => refillableTypes.has(String(asset.usesType || '').toLowerCase())
    && (asset.uses || 0) < printedMaximum(asset))

function replenishChargeOrOffering(inv, api) {
  const candidates = refillableAssets(inv)
  if (!candidates.length) {
    api.info('「邪恶祭祀刀」：没有可补满充能/贡品的支援。')
    return false
  }
  const id = candidates.length === 1 ? candidates[0].id : api.choice({
    kind: 'target', source: CODE, seat: inv.seat,
    prompt: '「邪恶祭祀刀」：选择要补满 1 充能或 1 贡品的支援。',
    options: candidates.map(asset => ({
      id: asset.id,
      label: `${api.cardName(asset.code)}（${asset.usesType === 'offerings' ? '贡品' : '充能'} ${asset.uses || 0}）`,
    })),
  })
  const target = candidates.find(asset => asset.id === id) || candidates[0]
  api.addUses(target, 1)
  api.info(`🗡 「邪恶祭祀刀」：${api.cardName(target.code)} 补满 1 个标记（当前 ${target.uses || 0}）。`)
  return true
}

export default {
  code: CODE,
  name: '邪恶祭祀刀',
  abilities: [
    {
      kind: 'action',
      countsAs: 'fight',
      label: '攻击：加入 1-3 个诅咒（每个 +2 战斗）；击败敌人则补满 1 充能/贡品',
      additionalTokenCost: { token: 'curse', operation: 'add', count: 1 },
      cost: { action: true },
      target: { kind: 'enemy' },
      resolve: ({ inv, source, target, api }) => {
        const enemy = target?.entity
        if (!enemy) return
        // 费用已由引擎加入 1 个诅咒；这里补足额外的 0-2 个（每多 1 个本次攻击再 +2 战斗）。
        const room = Math.min(2, api.chaosTokens.room('curse'))
        const extra = room ? Number(api.choice({
          kind: 'effect', source: CODE, seat: inv.seat,
          prompt: '「邪恶祭祀刀」：还要在混乱袋中加入几个诅咒标记？',
          options: Array.from({ length: room + 1 }, (_, index) => ({ id: String(index), label: '再加入 ' + index + ' 个' })),
        })) : 0
        const added = extra ? api.chaosTokens.add('curse', extra, { exact: true }) : 0
        const curses = 1 + added
        const result = api.fight(inv.seat, enemy.id, {
          assetId: source?.id,
          sourceCode: CODE,
          combatBonus: curses * 2,
        })
        if (result?.attackResult?.defeated) replenishChargeOrOffering(inv, api)
      },
    },
  ],
  modifiers: [],
}
