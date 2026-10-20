// 《失落的时代》补给品选购面板。
//
// 序幕与补给点会让每位调查员用补给品点数买装备（pickSupplies 待决选择）。
// 这个界面的两条约定：
//   1. 补给品是「卡牌式」选项：每张补给一张卡，带单价、卡面说明与已带数量；
//      买不起的卡照样显示，只是置灰并写明「点数不足」。
//   2. 「完成购买」不混在补给卡里：它在独立的完成栏里（宽屏在卡牌右侧，
//      窄屏排在卡牌之后），旁边写明未用完的点数会作废。
// 面板只读服务端下发的观察投影与合法动作：买得起与否、能提交哪一步都以
// legalMoves 为准，本地不扣点数、不发明选项。
import { renderRulesText } from './card-text.js'
import { tableIcon } from './table-components.js'

const CONTEXT_LABEL = Object.freeze({ prologue: '序幕', resupplyPoint: '补给点' })

// 从「配给（1 点）」这类旧标签里取出单价，作为缺少 supplyCosts 投影时的兜底。
function costFromLabel(label) {
  const matched = String(label ?? '').match(/（\s*(\d+)\s*点/)
  return matched ? Number(matched[1]) : null
}

export function supplyPickerModel(session) {
  const st = session?.state
  const choice = st?.pendingChoice
  if (!choice || choice.kind !== 'pickSupplies') return null
  const campaign = st.campaign || {}
  const labels = campaign.supplyLabels || {}
  const costs = campaign.supplyCosts || {}
  const hints = campaign.supplyHints || {}
  const context = choice.source?.context || 'prologue'
  const seat = choice.seat
  const remaining = Number.isFinite(campaign.supplyPoints?.[seat]) ? campaign.supplyPoints[seat] : null
  const purchasedNames = campaign.supplies?.[seat] || []
  const moves = new Map((st.legalMoves || [])
    .filter(move => move.action === 'choose' && move.choiceId === choice.id)
    .map(move => [String(move.optionId), move]))
  // 完整清单来自战役清单投影；旧存档没有这份投影时退回服务端给出的可购买项。
  const listed = campaign.supplyLists?.[context]
  const names = Array.isArray(listed) && listed.length
    ? [...listed]
    : [...new Set((choice.options || []).map(option => String(option.id)).filter(id => id !== 'done'))]
  const owned = new Map()
  for (const name of purchasedNames) owned.set(name, (owned.get(name) || 0) + 1)
  const items = names.map(name => {
    const option = (choice.options || []).find(entry => String(entry.id) === name)
    const listedCost = Number.isFinite(costs[name]) ? costs[name] : costFromLabel(option?.label)
    const affordable = remaining == null || listedCost == null || listedCost <= remaining
    const label = labels[name] || name
    return {
      name, label, hint: hints[name] || '', cost: listedCost,
      owned: owned.get(name) || 0,
      seal: [...label][0] || '物',
      move: moves.get(name) || null,
      affordable,
      // 服务端只给买得起的选项；两个条件同时成立才允许下单。
      purchasable: !!moves.get(name) && affordable,
    }
  })
  return {
    choice, context, contextLabel: CONTEXT_LABEL[context] || '远征', seat,
    investigator: (st.investigators || []).find(inv => inv.seat === seat) || null,
    remaining, items,
    purchased: [...owned].map(([name, count]) => ({ name, label: labels[name] || name, count })),
    done: moves.get('done') || null,
  }
}

function renderSupplyCard(h, item, interactive, onSubmit) {
  const actionLabel = item.affordable ? `购买 ${item.label}` : `${item.label}：点数不足`
  const detail = [
    item.label,
    item.cost == null ? null : `单价 ${item.cost} 点补给品点数`,
    item.owned ? `已带 ${item.owned}` : null,
    item.hint,
  ].filter(Boolean).join(' · ')
  return h('li', { className: 'ah-supply-market-cell' },
    h('button', {
      type: 'button',
      className: 'ah-supply-market-card'
        + (item.affordable ? '' : ' is-unaffordable')
        + (item.purchasable ? '' : ' is-unavailable'),
      'data-supply': item.name, 'data-option-id': item.name,
      'aria-label': actionLabel, title: detail,
      disabled: !interactive || !item.purchasable,
      onclick: () => item.move && onSubmit(item.move),
    },
      h('span', { className: 'ah-supply-market-card-top' },
        h('span', { className: 'ah-supply-market-seal', 'aria-hidden': 'true' }, item.seal),
        item.cost == null ? null : h('span', { className: 'ah-supply-market-cost' },
          item.cost, h('small', {}, '点'))),
      h('strong', { className: 'ah-supply-market-name' }, item.label),
      item.hint ? h('span', { className: 'ah-supply-market-hint' }, item.hint) : null,
      h('span', { className: 'ah-supply-market-meta' },
        item.owned ? h('span', { className: 'ah-supply-market-owned' }, `已带 ${item.owned}`) : null,
        item.affordable ? null : h('span', { className: 'ah-supply-market-locked' }, '点数不足'))))
}

export function renderSupplyPicker(h, model, { onSubmit = () => {}, disabled = false, busy = false } = {}) {
  if (!model) return null
  const name = model.investigator?.name || '该调查员'
  const interactive = !disabled
  const instruction = model.remaining == null
    ? renderRulesText(h, model.choice.prompt, { links: false })
    : `为${name}选购本次远征的补给品：点选一张补给卡即购买，点数用完为止。`
  const footNote = busy ? '正在提交购买…'
    : !interactive ? `等待${name}完成补给品选购…`
    : model.remaining == null ? '点选补给卡即可购买。'
    : `剩余 ${model.remaining} 点补给品点数；未用完的点数在完成购买后作废。配给、药品与汽油可以重复购买。`
  return h('section', {
    className: 'ah-supply-market', role: 'dialog', 'aria-label': '选择补给品',
    'data-choice-id': model.choice.id, 'data-choice-kind': 'pickSupplies', 'data-supply-context': model.context,
  },
    h('header', { className: 'ah-supply-market-head' },
      h('div', { className: 'ah-supply-market-title' },
        h('small', { className: 'ah-office-eyebrow' }, `远征装备 · ${model.contextLabel}`),
        h('h2', {}, '补给品选购'),
        h('p', { className: 'ah-supply-market-lead' }, tableIcon('supply'), h('span', {}, instruction))),
      h('div', {
        className: 'ah-supply-market-purse',
        role: 'status', 'aria-label': `剩余补给品点数 ${model.remaining ?? '未知'}`,
      },
        h('span', {}, '剩余补给品点数'),
        h('b', {}, model.remaining == null ? '—' : String(model.remaining)))),
    model.purchased.length
      ? h('div', { className: 'ah-supply-market-cart', role: 'list', 'aria-label': '已购买的补给品' },
        h('small', {}, '已购买'),
        model.purchased.map(item => h('span', { className: 'ah-supply-market-chip', role: 'listitem' },
          `${item.label}${item.count > 1 ? ` ×${item.count}` : ''}`)))
      : null,
    h('div', { className: 'ah-supply-market-body' },
      h('ul', { className: 'ah-supply-market-grid', 'aria-label': '可购买的补给品' },
        model.items.map(item => renderSupplyCard(h, item, interactive, onSubmit))),
      // 完成栏是独立的一列/一块，不混在补给卡里；宽屏时与卡牌并排，窄屏时排在卡牌之后。
      h('aside', { className: 'ah-supply-market-summary', 'aria-label': '完成选购' },
        h('p', { className: 'ah-supply-market-note', role: 'status' }, footNote),
        h('button', {
          type: 'button', className: 'bg-btn ah-supply-market-done', 'data-supply-done': 'true',
          disabled: !interactive || busy || !model.done,
          title: model.done?.label || '完成购买',
          onclick: () => model.done && onSubmit(model.done),
        }, '完成购买'))))
}
