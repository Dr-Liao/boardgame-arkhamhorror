// 诡镇界面词典完整性回归（docs/localization.md §6.1 / §8.2 / §9.2）。
//
// 语言包已拆成 core + 区域片段（hub/gameui/table/panels/lore/misc），由 zh-CN.js / en.js 聚合。
// 本文件守住：
//   1. 聚合后 zh-CN 与 en 的 key 一一对应、值非空、{占位符} 集合一致；
//   2. 各片段之间没有重复 key（聚合 spread 会静默覆盖，必须在测试里发现）；
//   3. en 词典不残留中文（`locale.zh-CN` 的 endonym「简体中文」是唯一允许项）；
//   4. web/*.js 里所有静态字面量 t('key') 都能在 zh-CN 词典命中（主路径不允许裸 key）；
//   5. 已本地化的 UI 文件里不再残留用户可见中文字符串（内容数据/协议正则按文件白名单排除）。
//
// 运行：node tests/i18n-dict.test.mjs（已注册进 fast tier 与 node-suite）。

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const WEB = path.join(ROOT, 'web')
const LOCALES = path.join(WEB, 'locales')
const AREAS = ['core', 'hub', 'gameui', 'table', 'panels', 'lore', 'misc']

const load = async file => (await import(pathToFileURL(file).href)).default
const zh = await load(path.join(LOCALES, 'zh-CN.js'))
const en = await load(path.join(LOCALES, 'en.js'))

function placeholders(value) {
  return [...String(value).matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

function cjkLines(source) {
  return stripComments(source).split('\n').filter(line => /[\u4e00-\u9fff]/.test(line))
}

test('聚合词典 zh-CN / en 的 key 一一对应、值非空、占位符一致', () => {
  const zhKeys = Object.keys(zh).sort()
  const enKeys = Object.keys(en).sort()
  assert.deepEqual(enKeys.filter(key => !Object.hasOwn(zh, key)), [], 'en 多出的 key')
  assert.deepEqual(zhKeys.filter(key => !Object.hasOwn(en, key)), [], 'en 缺少的 key')
  for (const [name, dict] of [['zh-CN', zh], ['en', en]]) {
    for (const [key, value] of Object.entries(dict)) {
      assert.equal(typeof value, 'string', name + ' 的 ' + key + ' 不是字符串')
      assert.notEqual(value.trim(), '', name + ' 的 ' + key + ' 为空')
    }
  }
  for (const key of zhKeys) {
    assert.deepEqual(placeholders(en[key]), placeholders(zh[key]), key + ' 的中英占位符不一致')
  }
})

test('区域片段之间没有重复 key（聚合 spread 会静默覆盖）', async () => {
  for (const locale of ['zh-CN', 'en']) {
    const seen = new Map()
    const duplicates = []
    for (const area of AREAS) {
      const file = path.join(LOCALES, `${locale}.${area}.js`)
      assert.ok(fs.existsSync(file), '缺少词典片段：' + path.basename(file))
      const dict = await load(file)
      for (const key of Object.keys(dict)) {
        if (seen.has(key)) duplicates.push(key + '（' + seen.get(key) + ' 与 ' + area + '）')
        else seen.set(key, area)
      }
    }
    assert.deepEqual(duplicates, [], locale + ' 词典片段存在重复 key')
  }
})

test('英文词典不残留中文（locale.zh-CN 的 endonym 除外）', () => {
  const allowed = new Set(['locale.zh-CN'])
  const bad = Object.entries(en).filter(([key, value]) => !allowed.has(key) && /[\u4e00-\u9fff]/.test(value))
  assert.deepEqual(bad, [], 'en 词典中仍有中文')
})

test('web/*.js 的静态 t(字面量) key 都能在 zh-CN 词典命中', () => {
  const files = fs.readdirSync(WEB).filter(name => name.endsWith('.js'))
  const missing = []
  for (const name of files) {
    const source = fs.readFileSync(path.join(WEB, name), 'utf8')
    // t('key') / t("key") / t(`key`)；带 + 拼接或变量的动态 key 跳过（它们由各处兜底处理）。
    for (const match of source.matchAll(/\bt\(\s*(['"`])((?:(?!\1)[^\\\n])+)\1\s*(?=[,)])/g)) {
      const key = match[2]
      if (!Object.hasOwn(zh, key)) missing.push(name + ': ' + key)
    }
  }
  assert.deepEqual(missing, [], '以下 t() key 不在 zh-CN 词典中')
})

// 已完成界面本地化的文件：除下方白名单中的内容数据/协议正则外，不应再有中文字符串。
const LOCALIZED_UI_FILES = [
  'hub.js', 'game-ui.js', 'situation-view.js', 'tcu-ui.js', 'table-presentation.js',
  'table-regions.js', 'table-components.js', 'table-timeline.js', 'card-filters.js',
  'supply-picker.js', 'chaos-bag-view.js', 'music-player.js', 'rulebook.js',
  'story-reader.js', 'card-zoom.js', 'table-art.js', 'campaign-records.js',
  'card-interactions.js', 'catalog.js', 'images.js', 'deck-rules.js', 'arkhamdb-import.js',
]
// 每个文件允许保留的中文行（内容数据、双语匹配正则等，不属于 UI 文案）。
const CJK_ALLOW = {
  // 卡面文本匹配用的双语正则（治愈…恐惧 / 治癒…恐懼）。
  'deck-rules.js': [/治愈/, /治癒/],
  // 曲目 mood 是内容数据（docs/localization.md §8.7：歌曲名与 mood 不属界面文案）。
  'music-player.js': [/\bmood:\s*['"]/],
}

test('已本地化的 UI 文件不再残留用户可见中文', () => {
  const leftovers = []
  for (const name of LOCALIZED_UI_FILES) {
    const source = fs.readFileSync(path.join(WEB, name), 'utf8')
    const allow = CJK_ALLOW[name] || []
    for (const line of cjkLines(source)) {
      if (allow.some(pattern => pattern.test(line))) continue
      leftovers.push(name + ': ' + line.trim().slice(0, 140))
    }
  }
  assert.deepEqual(leftovers, [], '以下 UI 文件仍有中文字符串，请抽到词典或加入白名单说明原因')
})
