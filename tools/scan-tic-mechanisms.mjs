import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { CYCLE_CODES, chapters } from '../content/campaigns/theInnsmouthConspiracy/shared.js'
import { REFERENCE, emit, readJson, sha, json } from './tic-migration-lib.mjs'
import { buildScope } from './scan-tic-scope.mjs'
import { MECHANISMS, PRIMITIVES } from './tic-mechanisms.mjs'

export function leaves(value, path = '') {
  return typeof value === 'string' ? [{ path, text: value }] : Object.entries(value || {}).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key))
}
export function buildScan() {
  const scope = buildScope()
  const mechanisms = MECHANISMS.map(def => ({ ...def, cards: CYCLE_CODES.filter(code => {
    const card = ALL_CARDS[code]
    return def.pattern ? new RegExp(def.pattern, 'i').test([card.text, card.backText].join('\n'))
      : ['scenario', 'location', 'act', 'agenda', 'story'].includes(card.type) || /[a-z]$/.test(code)
  }), source: ['frontend/public/cards.json', 'backend/arkham-api/library/Arkham/'],
    existing: def.candidatePrimitives.every(id => !PRIMITIVES[id]?.new),
    gap: def.candidatePrimitives.filter(id => PRIMITIVES[id]?.new),
  })).filter(def => def.cards.length)
  for (const chapter of chapters) mechanisms.push({ id: chapter.id, type: 'scenario', title: chapter.name,
    cards: CYCLE_CODES.filter(code => ALL_CARDS[code].encounterCode === chapter.encounterCode),
    source: scope.chapters.find(ch => ch.id === chapter.id).gather.source,
    existing: false, gap: ['P7 布置／特别规则／分支／结局及逐卡行为'], candidatePrimitives: [] })
  const cards = CYCLE_CODES.map(code => ({ code, textSha256: sha(json({ text: ALL_CARDS[code].text || '', backText: ALL_CARDS[code].backText || '' })),
    mechanisms: mechanisms.filter(def => def.cards.includes(code)).map(def => def.id),
    behaviorStatus: 'pending', // Classification is not literal-card acceptance.
  }))
  const guides = chapters.map(ch => {
    const en = readJson(join(REFERENCE, `frontend/src/locales/en/theInnsmouthConspiracy/scenarios/${ch.id}.json`))
    const zh = readJson(join(REFERENCE, `frontend/src/locales/zh/theInnsmouthConspiracy/scenarios/${ch.id}.json`))
    const chinese = new Map(leaves(zh).map(row => [row.path, row.text]))
    return { id: ch.id, sections: leaves(en).map(row => ({ path: row.path, sourceSha256: sha(row.text),
      specialRule: row.path.startsWith('specialRules.'),
      chinese: chinese.has(row.path) ? /[\u3400-\u9fff]/.test(chinese.get(row.path)) ? 'present-needs-review' : 'untranslated' : 'missing',
      status: 'pending', // Full bilingual guide delivery is a per-chapter P7 gate.
    })) }
  })
  const campaignSource = ['en', 'zh'].map(lang => ({ lang, paths: leaves(readJson(join(REFERENCE, `frontend/src/locales/${lang}/theInnsmouthConspiracy/base.json`))).map(row => ({ path: row.path, sha256: sha(row.text) })) }))
  return { schemaVersion: 1, cycle: 'tic', scopeSha256: sha(json(scope)), mechanisms, cards, guides, campaignSource,
    unclassified: cards.filter(card => !card.mechanisms.length).map(card => card.code),
    gates: { scopePassed: Object.values(scope.gates).every(Boolean), allCardsClassified: cards.every(card => card.mechanisms.length),
      primitiveCandidatesKnown: mechanisms.every(def => def.candidatePrimitives.every(id => id in PRIMITIVES)),
      sixTypesCovered: ['primitive', 'keyword', 'rulebook', 'interaction', 'scenario', 'content'].every(type => mechanisms.some(def => def.type === type)),
      allGuidesInventoried: guides.every(guide => guide.sections.some(row => row.path.startsWith('setup.')) && guide.sections.some(row => row.path.startsWith('resolutions.'))),
    } }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) emit('mechanism-scan', buildScan())
