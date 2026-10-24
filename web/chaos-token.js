// Original token faces from the bundled ArkhamHorror reference media.
// 显示名走 web/i18n.js 的 t()（渲染期取当前语言），这里只存 key（模块顶层不调用 t）。
import { t } from './i18n.js'

const ROOT = '/mods/arkhamhorror/img/chaos-tokens/'
const names = { skull:'chaos.token.skull', cultist:'chaos.token.cultist', tablet:'chaos.token.tablet', elderthing:'chaos.token.elderthing', eldersign:'chaos.token.eldersign', autofail:'chaos.token.autofail', bless:'chaos.token.bless', curse:'chaos.token.curse', frost:'chaos.token.frost', blank:'chaos.token.blank' }
const images = new Map()
const tokenLabel = key => Object.hasOwn(names,key) ? t(names[key]) : null
const face = value => {
  const key = String(value).toLowerCase().replaceAll('_','')
  return Object.hasOwn(names,key) ? key : key === '+1' ? 'plus1' : /^-[1-8]$/.test(key) ? 'minus'+key.slice(1) : key === '0' ? '0' : null
}
export function chaosTokenFace(value) {
  const key = face(value)
  return { key: key || String(value), label: tokenLabel(key) || String(value), src: key ? ROOT + 'ct-' + key + '.png' : null }
}
function preload(key) {
  if (!images.has(key)) {
    const image = new Image(); image.src = ROOT + 'ct-' + key + '.png'
    images.set(key,image.decode().catch(()=>{}))
  }
  return images.get(key)
}
export function preloadChaosTokens() {
  for(const key of [...Object.keys(names),'0','plus1',...Array.from({length:8},(_,i)=>'minus'+(i+1))]) preload(key)
}
export async function showChaosToken(holder, value) {
  const key = face(value), label = tokenLabel(key) || String(value)
  holder.dataset.chaosToken = String(value)
  holder.setAttribute('role','img'); holder.setAttribute('aria-label',label); holder.title = label
  if (!key) { holder.textContent = label; return }
  await preload(key)
  if (holder.dataset.chaosToken !== String(value)) return
  const img = document.createElement('img')
  img.src = ROOT + 'ct-' + key + '.png'; img.alt = ''; img.draggable = false
  holder.replaceChildren(img)
}
