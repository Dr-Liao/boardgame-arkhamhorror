// 九循环《铁杉谷盛宴》（FHV）P7 战役浏览器验收账本 writer。
// 唯一产物：audit/fhv-scenarios-browser.json（确定性：无时间戳、无绝对路径；tests 按标题排序）。
// 口径：spec 固定；桌面 1440 / 移动 390 各覆盖全部 12 个场景（4 序曲 + 8 章）且用例通过；
// 截图 ≥24 张且文件存在。标题约定：`P7 <viewport> <scenarioId> …`。
import { existsSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
const MOD = fileURLToPath(new URL('../', import.meta.url))
const LEDGER = join(MOD, 'audit/fhv-scenarios-browser.json')
const REQUIRED_SPECS = Object.freeze(['tests/fhv-scenarios.browser.mjs'])
const SCENARIO_IDS = Object.freeze([
  'welcomeToHemlockVale', 'writtenInRock', 'hemlockHouse', 'theSilentHeath', 'theLostSister',
  'theThingInTheDepths', 'theTwistedHollow', 'dawnOfTheSecondDay', 'theLongestNight',
  'dawnOfTheFinalDay', 'preludeTheFinalEvening', 'fateOfTheVale',
])
const byCodePoint = (left, right) => (left < right ? -1 : left > right ? 1 : 0)
const relativePath = path => relative(WORKSPACE, path).replaceAll('\\', '/')
const specOf = file => relative(MOD, file).replaceAll('\\', '/')
const viewportPassed = (entries, viewport) => SCENARIO_IDS.every(id => entries.some(entry =>
  entry.status === 'passed' && entry.title.startsWith(`P7 ${viewport} ${id}`)))

export default class FhvP7Reporter {
  onBegin() {
    this.entries = []
  }

  onTestEnd(test, result) {
    const key = `${specOf(test.location.file)}::${test.title}`
    this.entries = (this.entries || []).filter(entry => `${entry.file}::${entry.title}` !== key)
    this.entries.push({
      file: specOf(test.location.file),
      title: test.title,
      status: result.status,
      durationMs: Math.round(result.duration || 0),
      screenshots: (test.annotations || []).filter(item => item.type === 'screenshot' && item.description)
        .map(item => relativePath(item.description)).sort(byCodePoint),
    })
  }

  onEnd(result) {
    const tests = [...this.entries]
      .sort((left, right) => byCodePoint(left.file, left.title))
      .map(({ file, title, status, durationMs }) => ({ file, title, status, durationMs }))
    const specs = [...new Set(this.entries.map(entry => entry.file))].sort(byCodePoint)
    const missingSpecs = REQUIRED_SPECS.filter(spec => !specs.includes(spec))
    const screenshots = [...new Set(this.entries.flatMap(entry => entry.screenshots))].sort(byCodePoint)
    const screenshotsExist = screenshots.length >= 24 && screenshots.every(path => existsSync(join(WORKSPACE, path)))
    const checks = { desktop: viewportPassed(this.entries, 'desktop'), mobile: viewportPassed(this.entries, 'mobile') }
    const allPassed = this.entries.every(entry => entry.status === 'passed')
    const status = result.status === 'passed' && allPassed && !missingSpecs.length
      && screenshotsExist && checks.desktop && checks.mobile ? 'passed' : 'failed'
    writeFileSync(LEDGER, JSON.stringify({
      schemaVersion: 1,
      generatedBy: 'tools/playwright-fhv-p7-reporter.mjs',
      status, specs, checks, tests, screenshots,
    }, null, 2) + '\n')
    console.log(`fhv P7 browser acceptance: ${status} (${tests.filter(test => test.status === 'passed').length}/${tests.length} tests, `
      + `${screenshots.length} screenshots; desktop=${checks.desktop} mobile=${checks.mobile}) -> ${relativePath(LEDGER)}`)
    if (status !== 'passed') {
      const failures = this.entries.filter(entry => entry.status !== 'passed').map(entry => `${entry.file}::${entry.title}`)
      console.log(`  missingSpecs=${JSON.stringify(missingSpecs)} screenshotsExist=${screenshotsExist} failures=${JSON.stringify(failures)}`)
    }
  }
}
