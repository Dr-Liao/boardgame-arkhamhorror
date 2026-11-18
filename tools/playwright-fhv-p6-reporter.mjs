// 九循环《铁杉谷盛宴》（FHV）P6 一般玩家卡浏览器验收账本 writer。
// 唯一产物：audit/fhv-player-browser.json（确定性：无时间戳、无绝对路径；tests 按 (file,title) 排序）。
// 口径（与 TSK P6 报告器一致）：
//   · specs 必须包含 P6 玩家卡 spec；
//   · 双视口各 5 条用例（构筑池/事件/资产/技能/弱点）全部通过才算 passed；
//   · screenshots 相对大厅根目录、写账本时校验存在（≥10 张）。
import { existsSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
const MOD = fileURLToPath(new URL('../', import.meta.url))
const LEDGER = join(MOD, 'audit/fhv-player-browser.json')
const REQUIRED_SPECS = Object.freeze(['tests/fhv-player.browser.mjs'])
const MARKERS = Object.freeze(['构筑池开放', '事件卡真实打出', '资产卡装备与发动', '技能卡投入检定', '基础弱点显现进入威胁区'])
const byCodePoint = (left, right) => (left < right ? -1 : left > right ? 1 : 0)
const relativePath = path => relative(WORKSPACE, path).replaceAll('\\', '/')
const specOf = file => relative(MOD, file).replaceAll('\\', '/')
const viewportPassed = (entries, viewport) => MARKERS.every(marker => entries.some(entry =>
  entry.status === 'passed' && entry.title.startsWith(`P6 ${viewport} `) && entry.title.includes(marker)))

export default class FhvP6Reporter {
  onBegin() {
    this.entries = []
  }

  onTestEnd(test, result) {
    // 重试会用同一标题多次回调：按 (file,title) 保留最后一次结果。
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
      .sort((left, right) => byCodePoint(left.file, left.title) || byCodePoint(left.title, right.title))
      .map(({ file, title, status, durationMs }) => ({ file, title, status, durationMs }))
    const specs = [...new Set(this.entries.map(entry => entry.file))].sort(byCodePoint)
    const missingSpecs = REQUIRED_SPECS.filter(spec => !specs.includes(spec))
    const screenshots = [...new Set(this.entries.flatMap(entry => entry.screenshots))].sort(byCodePoint)
    const screenshotsExist = screenshots.length >= 10 && screenshots.every(path => existsSync(join(WORKSPACE, path)))
    const checks = { desktop: viewportPassed(this.entries, 'desktop'), mobile: viewportPassed(this.entries, 'mobile') }
    const allPassed = this.entries.every(entry => entry.status === 'passed')
    const status = result.status === 'passed' && allPassed && !missingSpecs.length
      && screenshotsExist && checks.desktop && checks.mobile ? 'passed' : 'failed'
    writeFileSync(LEDGER, JSON.stringify({
      schemaVersion: 1,
      generatedBy: 'tools/playwright-fhv-p6-reporter.mjs',
      status,
      specs,
      checks,
      tests,
      screenshots,
    }, null, 2) + '\n')
    console.log(`fhv P6 browser acceptance: ${status} (${tests.filter(test => test.status === 'passed').length}/${tests.length} tests, `
      + `${screenshots.length} screenshots; desktop=${checks.desktop} mobile=${checks.mobile}) -> ${relativePath(LEDGER)}`)
    if (status !== 'passed') {
      const failures = this.entries.filter(entry => entry.status !== 'passed').map(entry => `${entry.file}::${entry.title}`)
      console.log(`  missingSpecs=${JSON.stringify(missingSpecs)} screenshotsExist=${screenshotsExist} failures=${JSON.stringify(failures)}`)
    }
  }
}
