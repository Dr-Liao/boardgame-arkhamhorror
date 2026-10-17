import { chaosTokenFace } from './chaos-token.js'

// Read the live public bag, never the campaign's initial pool or draw order.
export function groupedChaosTokens(tokens = []) {
  const groups = new Map()
  for (const token of tokens) {
    const value = token && typeof token === 'object' ? token.token : token
    const face = chaosTokenFace(value)
    const group = groups.get(face.key) || { ...face, value, count: 0 }
    group.count++; groups.set(face.key, group)
  }
  const order = ['eldersign', 'skull', 'cultist', 'tablet', 'elderthing', 'autofail', 'bless', 'curse', 'frost']
  return [...groups.values()].sort((a,b)=>{
    const an = /^[+-]?\d+$/.test(String(a.value)), bn = /^[+-]?\d+$/.test(String(b.value))
    if (an && bn) return Number(b.value) - Number(a.value)
    if (an !== bn) return an ? -1 : 1
    const rank = key => order.includes(key) ? order.indexOf(key) : order.length
    return rank(a.key) - rank(b.key) || a.label.localeCompare(b.label)
  })
}

export function createChaosBagView(h, render) {
  let sessionId = null
  let cached=null, cachedKey=''
  const close = () => {
    sessionId = null; cached=null; cachedKey=''; render()
    queueMicrotask(()=>document.querySelector('.ah-chaos-bag')?.focus({preventScroll:true}))
  }
  const tokens = (items, zone) => h('ul', {className:'ah-bag-token-grid', 'data-bag-zone':zone},
    groupedChaosTokens(items).map(token=>h('li', {className:'ah-bag-token', 'data-token':token.key, 'aria-label':`${token.label}，${token.count} 枚`},
      token.src ? h('img', {src:token.src,alt:token.label,draggable:false}) : h('span',{className:'ah-bag-token-fallback'},token.label),
      h('strong',{},token.label),h('span',{className:'ah-bag-token-count'},'×'+token.count))))
  return {
    get opened() { return sessionId !== null },
    open(id) { sessionId=id; render() },
    reset() { sessionId=null; cached=null; cachedKey='' },
    render(session, blocked) {
      if (!sessionId) return null
      if (!session || session.sessionId !== sessionId) { this.reset(); return null }
      if (blocked) return null
      const state=session.state, bag=state.chaosBag || []
      const sealed=state.chaos?.sealed || state.sealedTokens || [], revealed=state.chaos?.revealed || []
      const key=JSON.stringify([sessionId,bag,sealed,revealed])
      const scroll=cached?.querySelector('.ah-bag-modal')?.scrollTop || 0
      if(cached&&cachedKey===key){
        const focus=cached.contains(document.activeElement)?document.activeElement:null
        queueMicrotask(()=>{if(cached?.isConnected){cached.querySelector('.ah-bag-modal').scrollTop=scroll;focus?.focus({preventScroll:true})}})
        return cached
      }
      const dismiss=h('button',{type:'button',className:'ah-bag-close','aria-label':'关闭混乱袋',onclick:close},'关闭')
      const modal=h('div',{className:'bg-backdrop ah-bag-backdrop'},
        h('section',{className:'ah-bag-modal',role:'dialog','aria-modal':'true','aria-label':'当前混乱袋',tabindex:-1,
          onclick:event=>event.stopPropagation(),onkeydown:event=>{
            if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close()}
            if(event.key==='Tab'){event.preventDefault();dismiss.focus({preventScroll:true})}
          }},
          h('header',{},h('img',{src:'/mods/arkhamhorror/img/ui/chaos-bag.webp',alt:''}),
            h('div',{},h('small',{},'调查装备 · CHAOS BAG'),h('h2',{},'当前混乱袋'),h('p',{},`袋内 ${bag.length} 枚 · ${groupedChaosTokens(bag).length} 种标记`)),dismiss),
          bag.length ? tokens(bag,'bag') : h('p',{className:'ah-bag-empty'},'当前袋中没有标记。'),
          revealed.length ? h('section',{className:'ah-bag-outside'},h('h3',{},`已揭示 · ${revealed.length} 枚`),tokens(revealed,'revealed')) : null,
          sealed.length ? h('section',{className:'ah-bag-outside'},h('h3',{},`已封印 · ${sealed.length} 枚`),tokens(sealed,'sealed')) : null,
          h('footer',{},'特殊标记的效果请查阅桌面上的剧本提示卡。已揭示和已封印标记不计入袋内数量。')))
      cached=modal;cachedKey=key
      queueMicrotask(()=>{if(dismiss.isConnected){modal.querySelector('.ah-bag-modal').scrollTop=scroll;dismiss.focus({preventScroll:true})}})
      return modal
    },
  }
}
