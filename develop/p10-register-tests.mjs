// P10 收尾：登记新测试（suites / node-suite / tcu-suite）与 npm 脚本（audit:tcu:all-cards）。
// 一次性脚本，逐条精确替换并校验次数；不重复添加。
import { readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const patch = (file, edits) => {
  const url = new URL(file, root)
  let text = readFileSync(url, 'utf8')
  let changed = 0
  for (const [from, to] of edits) {
    if (text.includes(to)) continue
    if (!text.includes(from)) throw new Error(`${file}: 找不到锚点：${from}`)
    text = text.replace(from, to)
    changed += 1
  }
  writeFileSync(url, text)
  console.log(`${file}: ${changed} 处`)
}

patch('tests/suites.mjs', [[
  "  'tcu-story.test.mjs', // 万象无终 P9：剧情导入/分支/幕间/隐私",
  "  'tcu-story.test.mjs', // 万象无终 P9：剧情导入/分支/幕间/隐私\n"
  + "  'tcu-campaign-card-acceptance.test.mjs', // 万象无终 P10：237 战役卡 + 34 关联面逐卡字面验收\n"
  + "  'tcu-all-card-ledger.test.mjs', // 万象无终 P10：377 条印刷记录全卡账本守卫",
]])

patch('tests/node-suite.mjs', [[
  "import './tcu-story.test.mjs'",
  "import './tcu-story.test.mjs'\nimport './tcu-campaign-card-acceptance.test.mjs'\nimport './tcu-all-card-ledger.test.mjs'",
]])

patch('tests/tcu-suite.mjs', [[
  "import './tcu-story.test.mjs'",
  "import './tcu-story.test.mjs'\nimport './tcu-campaign-card-acceptance.test.mjs'\nimport './tcu-all-card-ledger.test.mjs'",
]])

patch('package.json', [[
  '    "audit:tcu:player": "node tools/audit-tcu-player.mjs --check",',
  '    "audit:tcu:player": "node tools/audit-tcu-player.mjs --check",\n'
  + '    "audit:tcu:all-cards": "node tools/audit-tcu-all-cards.mjs --check",\n'
  + '    "test:tcu:cards": "node --test tests/tcu-campaign-card-acceptance.test.mjs tests/tcu-all-card-ledger.test.mjs",',
]])
