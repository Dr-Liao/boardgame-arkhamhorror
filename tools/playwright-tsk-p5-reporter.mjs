// 八循环《绯红密钥》（TSK）P5 调查员浏览器验收账本 writer。
//
// 唯一产物：audit/tsk-investigators-browser.json（确定性：无时间戳、无绝对路径；
// tests 按 (file,title) 排序、screenshots 去重排序）。
// 口径（与 TIC/EotE P5 报告器一致）：
//   · specs：实际跑到的 spec 文件（相对 Mod 根目录），必须包含 P5 调查员 spec；
//   · tests：{file,title,status,durationMs}，失败用例原样保留；
//   · checks.desktop / checks.mobile：6 位调查员在该视口下的用例全部通过才算 true；
//   · screenshots：相对大厅根目录的截图路径，写账本时校验存在；
//   · status=passed 需要：Playwright passed + 每条 passed + spec 齐全 + 12 张截图存在 + 两视口全真。
import { existsSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
const MOD = fileURLToPath(new URL('../', import.meta.url))
const LEDGER = join(MOD, 'audit/tsk-investigators-browser.json')
const REQUIRED_SPECS = Object.freeze(['tests/tsk-investigators.browser.mjs'])
const CODES = Object.freeze(['09001', '09004', '09008', '09011', '09015', '09018'])
const byCodePoint = (left, right) => (left < right ? -1 : left > right ? 1 : 0)
const relativePath = path => relative(WORKSPACE, path).replaceAll('\\', '/')
const specOf = file => relative(MOD, file).replaceAll('\\', '/')
const viewportPassed = (entries, viewport) => CODES.every(code => entries.some(entry =>
  entry.status === 'passed' && entry.title.startsWith(`P5 ${viewport} ${code} `)))

export default class TskP5Reporter {
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
      .sort((left, right) => byCodePoint(left.file, left.title) || byCodePoint(left.title, right.title))
      .map(({ file, title, status, durationMs }) => ({ file, title, status, durationMs }))
    const specs = [...new Set(this.entries.map(entry => entry.file))].sort(byCodePoint)
    const missingSpecs = REQUIRED_SPECS.filter(spec => !specs.includes(spec))
    const screenshots = [...new Set(this.entries.flatMap(entry => entry.screenshots))].sort(byCodePoint)
    const screenshotsExist = screenshots.length >= 12 && screenshots.every(path => existsSync(join(WORKSPACE, path)))
    const checks = {
      desktop: viewportPassed(this.entries, 'desktop'),
      mobile: viewportPassed(this.entries, 'mobile'),
    }
    const allPassed = this.entries.every(entry => entry.status === 'passed')
    const status = result.status === 'passed' && allPassed && !missingSpecs.length
      && screenshotsExist && checks.desktop && checks.mobile ? 'passed' : 'failed'
    writeFileSync(LEDGER, JSON.stringify({
      schemaVersion: 1,
      generatedBy: 'tools/playwright-tsk-p5-reporter.mjs',
      status,
      specs,
      checks,
      tests,
      screenshots,
    }, null, 2) + '\n')
    console.log(`tsk P5 browser acceptance: ${status} (${tests.filter(test => test.status === 'passed').length}/${tests.length} tests, `
      + `${screenshots.length} screenshots; desktop=${checks.desktop} mobile=${checks.mobile}) -> ${relativePath(LEDGER)}`)
    if (status !== 'passed') {
      const failures = this.entries.filter(entry => entry.status !== 'passed').map(entry => `${entry.file}::${entry.title}`)
      console.log(`  missingSpecs=${JSON.stringify(missingSpecs)} screenshotsExist=${screenshotsExist} failures=${JSON.stringify(failures)}`)
    }
  }
}
