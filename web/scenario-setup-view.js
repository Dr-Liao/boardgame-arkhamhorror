// 关卡设置：只读对照本关的开场、布置步骤和说明。
// 开局这些步骤已经由服务端做完；这里不提交行动，也不改对局。
import { t } from './i18n.js'

const paragraphs = text => String(text || '').split(/\n{2,}/).map(part => part.trim()).filter(Boolean)
const stepsOf = text => String(text || '').split(/(?<=[。！？])/).map(part => part.trim()).filter(Boolean)

export function createScenarioSetupView(h, { render }) {
  let sessionId = null
  let cached = null
  let cachedKey = ''

  const forget = () => { sessionId = null; cached = null; cachedKey = '' }
  const close = () => {
    forget()
    render()
    queueMicrotask(() => document.querySelector('[data-scenario-setup]')?.focus({ preventScroll: true }))
  }

  const trapFocus = event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
    if (event.key !== 'Tab') return
    const items = [...event.currentTarget.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
      .filter(el => el.getClientRects().length)
    if (!items.length) return
    const first = items[0], last = items.at(-1), current = document.activeElement
    if (event.shiftKey && (current === first || current === event.currentTarget)) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && current === last) { event.preventDefault(); first.focus() }
  }

  const section = (title, body) => h('section', { className: 'ah-setup-section' },
    h('h3', {}, title), body)

  const build = session => {
    const scenario = session.state?.scenario || {}
    const name = scenario.name || t('setup.title')
    const intro = paragraphs(scenario.intro)
    const steps = stepsOf(scenario.setup)
    const notes = paragraphs(scenario.setupNote)
    const dismiss = h('button', { type: 'button', className: 'ah-setup-close', 'aria-label': t('setup.closeAria'), onclick: close },
      h('span', { 'aria-hidden': 'true' }, '×'), h('span', {}, t('common.close')))
    return h('div', { className: 'bg-backdrop ah-setup-backdrop', onclick: close },
      h('section', {
        className: 'ah-setup-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('setup.aria'), tabindex: -1,
        onclick: event => event.stopPropagation(), onkeydown: trapFocus,
      },
      h('header', { className: 'ah-setup-head' },
        h('div', {},
          h('p', { className: 'ah-setup-kicker' }, t('setup.title')),
          h('h2', {}, name)),
        dismiss),
      h('div', { className: 'ah-setup-body' },
        intro.length ? section(t('setup.intro'), intro.map(text => h('p', {}, text))) : null,
        section(t('setup.steps'), steps.length
          ? h('ol', { className: 'ah-setup-steps' }, steps.map(text => h('li', {}, text)))
          : h('p', { className: 'ah-setup-empty' }, t('setup.empty'))),
        notes.length ? section(t('setup.note'), notes.map(text => h('p', {}, text))) : null,
        h('p', { className: 'ah-setup-footer' }, t('setup.footer')))))
  }

  return {
    get opened() { return sessionId !== null },
    open(id) { sessionId = id; render() },
    reset: forget,
    render(session) {
      if (!sessionId) return null
      if (!session || session.sessionId !== sessionId) { forget(); return null }
      const scenario = session.state?.scenario || {}
      const key = [sessionId, scenario.id, scenario.intro, scenario.setup, scenario.setupNote, t('setup.title')].join('\u0001')
      if (cached && cachedKey === key) return cached
      const first = !cached
      cached = build(session)
      cachedKey = key
      if (first) {
        const node = cached
        queueMicrotask(() => {
          if (node.isConnected) node.querySelector('.ah-setup-close')?.focus({ preventScroll: true })
        })
      }
      return cached
    },
  }
}
