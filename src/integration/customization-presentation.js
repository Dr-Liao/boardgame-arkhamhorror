import { ALL_CARDS } from '../cards/cards-data.js'

export function customizationPresentation(code, options) {
  const textZh = ALL_CARDS[code]?.customizationTextZh || ''
  const rows = [...textZh.matchAll(/^(□+)[ \t]*([^。\r\n]+)。[ \t]*(.*)$/gm)]
  const aligned = rows.length === options.length
    && options.every((option, index) => rows[index][1].length === option.checks)
  return options.map(({ name, checks, text, implemented }, index) => ({
    name, checks, text, implemented: implemented !== false,
    ...(aligned ? { nameZh: rows[index][2], textZh: rows[index][3] } : {}),
  }))
}
