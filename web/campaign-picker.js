import { campaignPresentation } from './campaign-presentation.js'
import { campaignCycle, CARD_POOL_RESTRICTION_ENABLED } from './deck-rules.js'
import { getLocale, t } from './i18n.js'
import { tableIcon } from './table-components.js'

const CATEGORY_LABELS = {
  seasonOne: 'hub.campaignPicker.seasonOne', returnTo: 'hub.campaignPicker.returnTo', sideStories: 'hub.campaignPicker.sideStories',
}
const CATEGORIES = Object.keys(CATEGORY_LABELS)
const modeLabel = mode => t(mode === 'draft' ? 'hub.campaignPicker.draft' : 'draft.standard')
const tabId = category => `ah-campaign-tab-${category}`

export function campaignChoices(game) {
  const campaigns = new Map((game.clientData?.campaigns || []).map(campaign => [campaign.id, campaign]))
  const options = game.settingsSpec.find(spec => spec.key === 'campaignId')?.options || []
  return options.map(({ value: id, label }) => {
    const campaign = campaigns.get(id)
    const baseId = id.replace(/^returnTo([A-Z])/, (_, first) => first.toLowerCase())
    const sideStory = campaign?.sideStory ?? (campaign?.scenarios?.length === 1 && campaign.scenarios[0].id === id)
    const category = baseId !== id ? 'returnTo' : sideStory ? 'sideStories' : 'seasonOne'
    const theme = campaignPresentation(baseId)
    return {
      id, category, name: (getLocale() === 'en' ? campaign?.nameEn : campaign?.name) || label,
      earlyAccess: campaign?.earlyAccess, scenarioCount: campaign?.scenarios?.length,
      image: theme.id === 'common' ? theme.assets.casefile : theme.assets.hubHero,
      accent: theme.palette.accent,
    }
  }).sort((a, b) => (campaignCycle(a.id) ?? Infinity) - (campaignCycle(b.id) ?? Infinity))
}

export function renderCampaignSummary(h, campaign, mode, open) {
  return h('button', { type: 'button', id: 'ah-campaign-picker-open', className: 'ah-campaign-summary',
    'aria-haspopup': 'dialog', 'aria-labelledby': 'ah-campaign-summary-label', 'aria-describedby': 'ah-campaign-summary-name ah-campaign-summary-mode',
    onclick: open },
    campaign ? h('img', { src: campaign.image, alt: '' }) : null,
    h('span', { className: 'ah-campaign-summary-copy' },
      h('small', { id: 'ah-campaign-summary-label' }, t('hub.campaignPicker.title')),
      h('strong', { id: 'ah-campaign-summary-name' }, campaign?.name || ''),
      h('small', { id: 'ah-campaign-summary-mode' }, modeLabel(mode))),
    h('span', { className: 'ah-campaign-arrow', 'aria-hidden': 'true' }, '›'))
}

export function renderCampaignPicker(h, { choices, picker, settingsSpec, close, confirm, onChange, onkeydown }) {
  const { category, campaignId, deckMode } = picker
  const selected = choices.find(campaign => campaign.id === campaignId)
  const visible = choices.filter(campaign => campaign.category === category)
  const scope = CARD_POOL_RESTRICTION_ENABLED ? settingsSpec.find(spec => spec.key === 'cardPoolScope') : null
  const boxes = visible.length ? h('div', { className: 'ah-campaign-boxes' }, visible.map(campaign => {
    const active = campaign.id === campaignId
    const details = [
      campaign.scenarioCount && t('hub.campaignPicker.scenarios', { count: campaign.scenarioCount }),
      campaign.earlyAccess && t('hub.campaignPicker.earlyAccess'),
    ].filter(Boolean).join(' · ')
    return h('button', { type: 'button', className: 'ah-campaign-box', 'data-campaign-id': campaign.id,
      'data-focus-key': `campaign-box:${campaign.id}`, 'aria-pressed': String(active),
      style: { '--ah-box-accent': campaign.accent }, onclick: () => onChange({ campaignId: campaign.id }) },
      h('span', { className: 'ah-campaign-box-cover' }, h('img', { src: campaign.image, alt: '', draggable: 'false', loading: 'lazy' }),
        active ? h('span', { className: 'ah-campaign-box-check', 'aria-hidden': 'true' }, '✓') : null),
      h('span', { className: 'ah-campaign-box-copy' }, h('strong', {}, campaign.name), details ? h('small', {}, details) : null))
  })) : h('p', { className: 'ah-campaign-picker-empty' }, t('hub.campaignPicker.empty'))
  const changeTab = next => onChange({ category: next }, tabId(next))
  const tabKeys = event => {
    const index = CATEGORIES.indexOf(category)
    const next = { ArrowLeft: (index + CATEGORIES.length - 1) % CATEGORIES.length,
      ArrowRight: (index + 1) % CATEGORIES.length, Home: 0, End: CATEGORIES.length - 1 }[event.key]
    if (next == null) return
    event.preventDefault()
    changeTab(CATEGORIES[next])
  }
  return h('div', { className: 'ah-campaign-picker-backdrop', onclick: event => { if (event.target === event.currentTarget) close() } },
    h('section', { className: 'ah-campaign-picker ah-theme', role: 'dialog', 'aria-modal': 'true',
      'aria-labelledby': 'ah-campaign-picker-title', onkeydown },
      h('header', { className: 'ah-campaign-picker-header' },
        h('h2', { id: 'ah-campaign-picker-title' }, t('hub.campaignPicker.title')),
        h('button', { type: 'button', className: 'bg-btn secondary ah-campaign-picker-close',
          'aria-label': t('common.close'), 'data-focus-key': 'campaign-close', onclick: close }, '×')),
      h('div', { className: 'ah-campaign-picker-tabs', role: 'tablist', 'aria-label': t('hub.campaignPicker.categories') },
        CATEGORIES.map(key => h('button', { type: 'button', role: 'tab', id: tabId(key),
          'aria-controls': `ah-campaign-panel-${key}`, 'aria-selected': String(key === category), tabindex: key === category ? '0' : '-1',
          'data-focus-key': `campaign-tab:${key}`, onclick: () => changeTab(key), onkeydown: tabKeys }, t(CATEGORY_LABELS[key])))),
      CATEGORIES.map(key => h('div', { className: 'ah-campaign-picker-content', role: 'tabpanel', id: `ah-campaign-panel-${key}`,
        'aria-labelledby': tabId(key), hidden: key !== category, 'data-scroll-context': key }, key === category ? boxes : null)),
      h('div', { className: 'ah-campaign-picker-settings' },
        h('fieldset', { 'aria-describedby': 'ah-campaign-picker-mode-note' },
          h('legend', {}, t('hub.campaignPicker.mode')),
          h('div', { className: 'ah-campaign-mode-options' }, ['standard', 'draft'].map(mode =>
            h('label', { className: 'ah-campaign-mode' },
              h('input', { type: 'radio', name: 'ah-campaign-deck-mode', value: mode, checked: deckMode === mode,
                'data-focus-key': `campaign-mode:${mode}`, onchange: () => onChange({ deckMode: mode }) }),
              h('span', {}, tableIcon(mode === 'draft' ? 'tarot' : 'book'), modeLabel(mode)))))),
        h('p', { id: 'ah-campaign-picker-mode-note' }, t(deckMode === 'draft' ? 'draft.modeDescription' : 'draft.standardDescription')),
        h('fieldset', { className: 'ah-campaign-picker-advanced' },
          h('legend', {}, t('hub.gameSettings.title')),
          h('label', { className: 'ah-campaign-rollback' },
            h('input', { type: 'checkbox', checked: picker.allowRollback !== 'off', 'data-focus-key': 'campaign-rollback',
              'aria-describedby': 'ah-campaign-rollback-note',
              onchange: event => onChange({ allowRollback: event.target.checked ? 'on' : 'off' }) }),
            t('hub.gameSettings.rollbackLabel')),
          h('small', { id: 'ah-campaign-rollback-note' }, t('hub.gameSettings.rollbackNote')),
          scope ? h('label', { className: 'ah-campaign-card-pool', title: scope.description },
            scope.label,
            h('select', { 'data-focus-key': 'campaign-card-pool',
              onchange: event => onChange({ cardPoolScope: event.target.value }) },
              scope.options.map(option => h('option', { value: option.value,
                selected: option.value === (picker.cardPoolScope ?? scope.default) }, option.label)))) : null)),
      h('footer', { className: 'ah-campaign-picker-footer' },
        h('span', { role: 'status' }, selected?.name || ''),
        h('button', { type: 'button', className: 'bg-btn', disabled: !selected, 'data-focus-key': 'campaign-confirm', onclick: confirm },
          t('hub.campaignPicker.confirm')))))
}
