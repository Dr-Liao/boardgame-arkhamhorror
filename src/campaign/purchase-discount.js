import { assertFields, integer } from '../engine/mechanic-state.js'

function validate(spec) {
  assertFields(spec, ['amount', 'uses', 'traits'])
  integer(spec.amount, 1)
  integer(spec.uses, 1)
  if (spec.traits != null && (!Array.isArray(spec.traits) || !spec.traits.length
    || spec.traits.some(value => typeof value !== 'string' || !value.trim()))) throw new TypeError('无效购牌减免特质')
}

export function grantPurchaseDiscount(campaign, seat, spec) {
  const record = campaign.investigators[seat]
  if (!record || record.purchaseDiscount) return false
  validate(spec)
  record.purchaseDiscount = structuredClone(spec)
  return true
}

export function temporaryPurchaseDiscount(record, added, removed, cost) {
  const discount = record.purchaseDiscount
  if (!discount || cost <= 0 || added.name === removed?.name) return 0
  if (discount.traits && !discount.traits.some(trait => added.traits?.some(value => value.toLowerCase() === trait.toLowerCase()))) return 0
  return Math.min(cost, discount.amount)
}

export function spendPurchaseDiscount(record) {
  if (--record.purchaseDiscount.uses === 0) delete record.purchaseDiscount
}

export function expirePurchaseDiscounts(campaign) {
  for (const record of Object.values(campaign.investigators || {})) {
    if (record.purchaseDiscount) delete record.purchaseDiscount
    if (record.upgradeDraft?.record?.purchaseDiscount) delete record.upgradeDraft.record.purchaseDiscount
  }
}

export function validatePurchaseDiscounts(campaign) {
  for (const record of Object.values(campaign?.investigators || {})) {
    if (record.purchaseDiscount != null) validate(record.purchaseDiscount)
    if (record.upgradeDraft?.record?.purchaseDiscount != null) validate(record.upgradeDraft.record.purchaseDiscount)
  }
}
