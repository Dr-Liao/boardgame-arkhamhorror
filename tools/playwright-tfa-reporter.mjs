import { mkdirSync, writeFileSync } from 'node:fs'
import { basename, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chapters } from '../content/campaigns/theForgottenAge/shared.js'

const packageRoot = fileURLToPath(new URL('../', import.meta.url))
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const target = new URL('../audit/tfa-browser-acceptance.json', import.meta.url)
const requiredSpecs = ['tests/tfa-rules.browser.mjs', 'tests/tfa-scenarios.browser.mjs',
  'tests/tfa-release.browser.mjs', 'tests/tfa-online.browser.mjs', 'tests/tfa-supplies.browser.mjs']
const normalize = value => value.replace(/\\/g, '/')
const viewportOf = title => title.includes('mobile') ? 'mobile' : 'desktop'

export default class TfaBrowserReporter {
  constructor() { this.tests = []; this.screenshots = [] }

  onTestEnd(test, result) {
    const spec = normalize(relative(packageRoot, test.location.file))
    if (!requiredSpecs.includes(spec)) return
    const viewport = viewportOf(test.title)
    const scenario = test.annotations.find(item => item.type === 'scenario')?.description || null
    this.tests.push({ spec, title: test.title, viewport, scenario, status: result.status })
    if (result.status !== 'passed') return
    for (const annotation of test.annotations) {
      if (annotation.type !== 'screenshot' || !annotation.description) continue
      const path = normalize(relative(repoRoot, annotation.description))
      this.screenshots.push({ name: basename(path, '.png'), path,
        base: 'repo-root', spec, viewport, scenario })
    }
  }

  onEnd(result) {
    const tests = this.tests.sort((a, b) => `${a.spec}${a.title}`.localeCompare(`${b.spec}${b.title}`))
    const screenshots = this.screenshots.sort((a, b) => a.path.localeCompare(b.path))
    const passed = result.status === 'passed' && tests.length >= 30
      && tests.every(item => item.status === 'passed')
      && requiredSpecs.every(spec => tests.some(item => item.spec === spec))
    const evidence = (spec, viewport, scenario = null) =>
      passed && tests.some(item => item.spec === spec && item.viewport === viewport
        && item.scenario === scenario && item.status === 'passed')
      && screenshots.some(item => item.spec === spec && item.viewport === viewport
        && item.scenario === scenario)
    const scenarios = chapters.map(chapter => ({ scenario: chapter.id,
      desktop: evidence('tests/tfa-scenarios.browser.mjs', 'desktop', chapter.id),
      mobile: evidence('tests/tfa-scenarios.browser.mjs', 'mobile', chapter.id) }))
    const release = {
      desktop: evidence('tests/tfa-release.browser.mjs', 'desktop'),
      mobile: evidence('tests/tfa-release.browser.mjs', 'mobile'),
      screenshots: screenshots.filter(item => item.spec === 'tests/tfa-release.browser.mjs').map(item => item.path),
    }
    const online = { desktop: evidence('tests/tfa-online.browser.mjs', 'desktop'),
      mobile: evidence('tests/tfa-online.browser.mjs', 'mobile') }
    const supplies = { desktop: evidence('tests/tfa-supplies.browser.mjs', 'desktop'),
      mobile: evidence('tests/tfa-supplies.browser.mjs', 'mobile') }
    const report = {
      schemaVersion: 2,
      generatedBy: 'playwright + tools/playwright-tfa-reporter.mjs',
      command: 'npm run test:tfa:browser', campaignId: 'theForgottenAge',
      status: passed && scenarios.every(item => item.desktop && item.mobile)
        && release.desktop && release.mobile && online.desktop && online.mobile
        && supplies.desktop && supplies.mobile ? 'passed' : 'failed',
      specs: requiredSpecs,
      checks: { desktopBrowser: evidence('tests/tfa-rules.browser.mjs', 'desktop'),
        mobileBrowser: evidence('tests/tfa-rules.browser.mjs', 'mobile'), release, online, supplies },
      release, online, supplies, scenarios, tests, screenshots,
    }
    mkdirSync(new URL('../audit/', import.meta.url), { recursive: true })
    writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`)
    console.log(`tfa browser acceptance: ${report.status}; ${tests.length} tests; ${scenarios.filter(item => item.desktop && item.mobile).length}/10 chapters`)
  }
}
