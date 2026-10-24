// P10：把 TCU 浏览器证据命令扩成 5 个 spec（规则书/交互/逐章/发布实机/媒体资源），
// 并新增逐卡账本命令的 README 同步由 Lead 手工完成。
import { readFileSync, writeFileSync } from 'node:fs'
const url = new URL('../package.json', import.meta.url)
const text = readFileSync(url, 'utf8')
const from = '    "test:tcu:browser": "playwright test --config playwright.tcu.config.mjs tcu-rules.browser.mjs tcu-interactions.browser.mjs tcu-scenarios.browser.mjs",'
const to = '    "test:tcu:browser": "playwright test --config playwright.tcu.config.mjs tcu-rules.browser.mjs tcu-interactions.browser.mjs tcu-scenarios.browser.mjs tcu-release.browser.mjs tcu-media.browser.mjs",'
if (!text.includes(from)) {
  if (text.includes(to)) {
    console.log('already updated')
    process.exit(0)
  }
  throw new Error('test:tcu:browser 脚本行未找到')
}
writeFileSync(url, text.replace(from, to))
console.log('test:tcu:browser 已扩为 5 个 spec')
