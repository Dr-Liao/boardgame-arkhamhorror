import { scenarioPlaylistId } from './scenario-music.js'

const ROOT = '/mods/arkhamhorror'
const CARCOSA = `${ROOT}/img/campaigns/thePathToCarcosa`
const DUNWICH = `${ROOT}/img/campaigns/theDunwichLegacy`

const COMMON = Object.freeze({
  id: 'common',
  palette: Object.freeze({
    background: '#101e1a', panel: '#11251e', header: '#09130f',
    accent: '#dfc58d', accentStrong: '#f2d99b', muted: '#acb7a4', edge: '#b59b604b',
  }),
  assets: Object.freeze({
    hubHero: `${ROOT}/img/ui/hub-manor.webp`,
    hubDesk: `${ROOT}/img/ui/hub-desk.webp`,
    casefile: `${ROOT}/img/ui/hub-casefile.webp`,
    tableOverlay: `${ROOT}/img/ui/investigation-map.webp`,
    storyDefault: `${ROOT}/img/ui/hub-manor.webp`,
  }),
  musicPlaylist: 'common',
  scenarios: Object.freeze({}),
})

const CAMPAIGNS = Object.freeze({
  theDunwichLegacy: Object.freeze({
    id: 'theDunwichLegacy',
    assets: Object.freeze({
      hubHero: `${DUNWICH}/hub/dunwich-village.webp`,
      tableOverlay: `${DUNWICH}/table/investigation-desk.webp`,
      storyDefault: `${DUNWICH}/hub/dunwich-village.webp`,
    }),
    musicPlaylist: 'theDunwichLegacy',
    scenarios: Object.freeze(Object.fromEntries([
      'extracurricularActivity', 'theHouseAlwaysWins', 'theMiskatonicMuseum', 'theEssexCountyExpress',
      'bloodOnTheAltar', 'undimensionedAndUnseen', 'whereDoomAwaits', 'lostInTimeAndSpace',
    ].map(id => [id, Object.freeze({ assets: Object.freeze({
      storyDefault: `${DUNWICH}/scenarios/${id}/scene.webp`,
    }) })]))),
  }),
  thePathToCarcosa: Object.freeze({
    id: 'thePathToCarcosa',
    palette: Object.freeze({
      background: '#111b1d', panel: '#172427', header: '#0b1215',
      accent: '#c8ad64', accentStrong: '#efd88c', muted: '#a5aaa0', edge: '#b8975266',
    }),
    assets: Object.freeze({
      hubHero: `${CARCOSA}/hub/theatre.webp`,
      tableOverlay: `${CARCOSA}/table/investigation-desk.webp`,
      storyDefault: `${CARCOSA}/hub/theatre.webp`,
    }),
    musicPlaylist: 'thePathToCarcosa',
    scenarios: Object.freeze(Object.fromEntries([
      'curtainCall', 'theLastKing', 'echoesOfThePast', 'theUnspeakableOath',
      'aPhantomOfTruth', 'thePallidMask', 'blackStarsRise', 'dimCarcosa',
    ].map(id => [id, Object.freeze({ assets: Object.freeze({
      storyDefault: id === 'curtainCall' ? `${CARCOSA}/hub/theatre.webp` : `${CARCOSA}/scenarios/${id}/scene.webp`,
    }) })]))),
  }),
  nightOfTheZealot: Object.freeze({
    id: 'nightOfTheZealot',
    palette: Object.freeze({
      background: '#0b1518', panel: '#102226', header: '#071014',
      accent: '#c99a54', accentStrong: '#efc878', muted: '#91a8a2', edge: '#9c754f66',
    }),
    assets: Object.freeze({
      hubHero: `${ROOT}/img/campaigns/nightOfTheZealot/hub/office-hero.webp`,
      tableOverlay: `${ROOT}/img/campaigns/nightOfTheZealot/table/investigation-map.webp`,
      storyDefault: `${ROOT}/img/campaigns/nightOfTheZealot/story/default.png`,
    }),
    musicPlaylist: 'nightOfTheZealot',
    scenarios: Object.freeze({}),
  }),
})

export function campaignPresentation(campaignId, scenarioId = '') {
  const campaign = CAMPAIGNS[campaignId] || {}
  const scenario = campaign.scenarios?.[scenarioId] || {}
  return {
    id: campaign.id || COMMON.id,
    palette: { ...COMMON.palette, ...campaign.palette, ...scenario.palette },
    assets: { ...COMMON.assets, ...campaign.assets, ...scenario.assets },
    musicPlaylist: scenarioPlaylistId(campaignId, scenarioId) || scenario.musicPlaylist || campaign.musicPlaylist
      || (campaignId === 'theDunwichLegacy' ? 'theDunwichLegacy' : COMMON.musicPlaylist),
  }
}

export function presentationAsset(state, key) {
  return campaignPresentation(state?.campaign?.id, state?.scenario?.id || state?.hubSelectedScenarioId).assets[key]
}

export function presentationAttributes(state) {
  const campaignId = state?.campaign?.id || 'common'
  const scenarioId = state?.scenario?.id || state?.hubSelectedScenarioId || ''
  const theme = campaignPresentation(campaignId, scenarioId)
  const color = theme.palette
  return {
    'data-campaign': campaignId,
    'data-scenario': scenarioId || null,
    'data-presentation-theme': theme.id,
    style: {
      '--ah-theme-bg': color.background,
      '--ah-theme-panel': color.panel,
      '--ah-theme-header': color.header,
      '--ah-theme-accent': color.accent,
      '--ah-theme-accent-strong': color.accentStrong,
      '--ah-theme-muted': color.muted,
      '--ah-theme-edge': color.edge,
      '--ah-table-overlay-image': `url("${theme.assets.tableOverlay}")`,
    },
  }
}

export function campaignPlaylistId(state) {
  // A hub may still carry the previous table state after selecting the next chapter.
  const inHub = ['campaignHub', 'scenarioSetup', 'interlude'].includes(state?.uiState)
  const scenarioId = inHub ? state?.hubSelectedScenarioId || state?.scenario?.id
    : state?.scenario?.id || state?.hubSelectedScenarioId
  return campaignPresentation(state?.campaign?.id, scenarioId).musicPlaylist
}

export const CAMPAIGN_PRESENTATIONS = CAMPAIGNS
