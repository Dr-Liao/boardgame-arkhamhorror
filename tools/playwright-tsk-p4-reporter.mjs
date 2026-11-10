// 八循环《绯红密钥》（TSK）P4 浏览器验收账本 writer。
//
// 唯一产物：audit/tsk-interactions-browser.json（确定性：无时间戳、无绝对路径；
// tests 按 (file, title) 排序、screenshots 去重排序，重复运行只有 durationMs 变化）。
// 由 tests/playwright/playwright.tsk-p4.config.mjs 的 reporter 调用。
//
// 口径（与 TIC/EotE P4 报告器一致）：
//   · specs：本次实际跑到的 spec 文件（相对 Mod 根目录），必须包含配置 testMatch 的三条证据 spec；
//   · tests：{file,title,status,durationMs}，失败用例原样保留；
//   · screenshots：相对大厅根目录的截图路径，写账本时校验文件存在；
//   · status=passed 需要：Playwright 整体 passed + 每条用例 passed + 三份 spec 都跑到 + 截图存在。
//     任一条件不满足都写 status=failed（失败也写账本，不伪造完成）。
import { existsSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
const MOD = fileURLToPath(new URL('../', import.meta.url))
const LEDGER = join(MOD, 'audit/tsk-interactions-browser.json')
// 配置 testMatch 的三条证据 spec（路径相对 Mod 根目录，与 tests[].file 同口径）；缺任何一条都视为证据不完整。
const REQUIRED_SPECS = Object.freeze([
  'tests/tsk-interactions.browser.mjs',
  'tests/scenario-guides.browser.mjs',
  'tests/script-actions-tfa.browser.mjs',
])
const byCodePoint = (left, right) => (left < right ? -1 : left > right ? 1 : 0)
const relativePath = path => relative(WORKSPACE, path).replaceAll('\\', '/')
const specOf = file => relative(MOD, file).replaceAll('\\', '/')

export default class TskP4Reporter {
  onBegin() {
    this.entries = []
  }

  onTestEnd(test, result) {
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
      .sort((left, right) => byCodePoint(left.file, right.file) || byCodePoint(left.title, right.title))
      .map(({ file, title, status, durationMs }) => ({ file, title, status, durationMs }))
    const specs = [...new Set(this.entries.map(entry => entry.file))].sort(byCodePoint)
    const missingSpecs = REQUIRED_SPECS.filter(spec => !specs.includes(spec))
    const screenshots = [...new Set(this.entries.flatMap(entry => entry.screenshots))].sort(byCodePoint)
    const screenshotsExist = screenshots.length > 0 && screenshots.every(path => existsSync(join(WORKSPACE, path)))
    const allPassed = this.entries.every(entry => entry.status === 'passed')
    const status = result.status === 'passed' && allPassed && !missingSpecs.length && screenshotsExist
      ? 'passed' : 'failed'
    writeFileSync(LEDGER, JSON.stringify({
      schemaVersion: 1,
      generatedBy: 'tools/playwright-tsk-p4-reporter.mjs',
      status,
      specs,
      tests,
      screenshots,
    }, null, 2) + '\n')
    console.log(`tsk P4 browser acceptance: ${status} (${tests.filter(test => test.status === 'passed').length}/${tests.length} tests, `
      + `${screenshots.length} screenshots) -> ${relativePath(LEDGER)}`)
    if (status !== 'passed') {
      const failures = this.entries.filter(entry => entry.status !== 'passed').map(entry => `${entry.file}::${entry.title}`)
      console.log(`  missingSpecs=${JSON.stringify(missingSpecs)} screenshotsExist=${screenshotsExist} failures=${JSON.stringify(failures)}`)
    }
  }
}
