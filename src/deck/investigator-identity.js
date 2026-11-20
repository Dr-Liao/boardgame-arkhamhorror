import { INVESTIGATORS } from '../cards/cards-data.js'

// The catalog's canonical title is shared by different printings. Use the
// definition, never a localized display name or a name supplied by a client.
export function investigatorIdentity(code, definitions = INVESTIGATORS) {
  const title = definitions[code]?.name?.normalize('NFKC').trim().toLowerCase()
  return title ? `title:${title}` : `code:${code}`
}

export function campaignInvestigatorRecords(campaign) {
  return [campaign, ...Object.values(campaign?.parts || {})].flatMap(part => [
    ...Object.values(part?.investigators || {}), ...(part?.retired || []),
  ])
}
