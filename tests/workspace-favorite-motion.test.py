"""Optional real Chromium DOM/layout test: python tests/workspace-favorite-motion.test.py
Requires Python Playwright and Chromium. Loads the actual markup/style/script in
an in-memory page, with a deterministic shared-storage and offline stub.
"""
from pathlib import Path
import re
import os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
WS = ROOT / 'workspace'
html = re.sub(r'<script\b[^>]*>.*?</script>|<link\b[^>]*>', '', (WS / 'index.html').read_text(), flags=re.S)
css = (WS / 'workspace.css').read_text()
mock = '''() => {
  const repos = ['A','B','C','D','E'].map(label => ({label, type:({A:'game',B:'tool',C:'misc',D:'unknown'})[label]||'tool', url:'apps/'+label+'/index.html'}));
  let installed = [];
  window.setInstalled = labels => {installed=labels; window.dispatchEvent(new Event('online'))};
  const stores = {workspace:{selected:'favorites'}, favorites:['A','B','C','D'], favoriteOrder:['A','B','C','D'], workspaceRecentApps:['E']};
  window.BoilerRoom = {data:{repos, types:{tool:{label:'Tool'}}, getGroups:()=>new Map([['all',{label:'Alle',repos}]])},
    storage:{init(){},get:k=>structuredClone(stores[k]??false),set:(k,v)=>{stores[k]=structuredClone(v)},isAvailable:()=>true},
    offline:{async snapshot(){return installed.map(id=>({id,complete:true}))}, localEntry:(repo,record)=>record?.complete?repo.url:null, supported:false},
    searchRelevance:{normalize:s=>s.toLowerCase(),score:(r,q)=>r.label.toLowerCase().includes(q)?0:-1},
    toast:{showFavorite(){},showMessage(){}}};
  window.setFavorites = labels => {stores.favorites=labels; stores.favoriteOrder=labels; window.dispatchEvent(new StorageEvent('storage',{key:'boilerRoom'}))};
  window.labels = () => [...document.querySelectorAll('#homeWorkspaceApps > .app-card')].map(n=>n.dataset.label);
  window.animations = label => document.querySelector('#homeWorkspaceApps > [data-label="'+label+'"]').getAnimations().map(a=>a.effect.getKeyframes());
}'''
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'), args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1024, 'height': 850}, reduced_motion='no-preference')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.set_content(html)
    page.add_style_tag(content=css)
    page.evaluate(mock)
    page.add_script_tag(content=(ROOT/'js/favorites.js').read_text())
    source=(WS/'workspace.js').read_text()
    page.evaluate('''(source) => { const location={href:'https://example.test/project/workspace/index.html', search:''}; const history={replaceState(){}}; eval(source); }''', source)
    assert page.evaluate('labels()') == ['A','B','C','D']
    assert page.evaluate('animations("A")') == []
    # v47: existing favorite nodes update their installation status in place.
    card_a=page.locator('#homeWorkspaceApps > [data-label="A"]')
    card_b=page.locator('#homeWorkspaceApps > [data-label="B"]')
    card_c=page.locator('#homeWorkspaceApps > [data-label="C"]')
    card_d=page.locator('#homeWorkspaceApps > [data-label="D"]')
    assert page.locator('.app-type').count()==0
    for card,color in [(card_a,'rgb(255, 155, 89)'),(card_b,'rgb(116, 204, 228)'),(card_c,'rgb(123, 217, 162)'),(card_d,'rgb(160, 170, 185)')]:
        dot=card.locator('.app-type-dot')
        assert dot.evaluate('(e)=>getComputedStyle(e).backgroundColor')==color
        assert dot.get_attribute('aria-hidden')=='true'
        a=dot.bounding_box(); b=card.locator('.app-name').bounding_box()
        assert abs(a['width']-7/3)<0.05 and abs(a['height']-7/3)<0.05
        assert a['x']+a['width']<=b['x']
        assert abs(a['y']+a['height']/2-b['y']-b['height']/2)<1
    page.evaluate("""window.v47Node=document.querySelector('#homeWorkspaceApps > [data-label="A"]'); setInstalled(["A","E"])""")
    page.wait_for_function('v47Node.querySelector(".app-item").classList.contains("is-installed")')
    assert page.evaluate("""v47Node===document.querySelector('#homeWorkspaceApps > [data-label="A"]')""")
    assert card_a.locator('.app-icon').bounding_box()['width']==68
    assert card_b.locator('.app-icon').bounding_box()['width']==56
    assert page.locator('#homeApps .app-icon').bounding_box()['width']==68
    assert 'Offline' not in card_a.inner_text()
    assert 'Offline installiert' in card_a.locator('.app-item').get_attribute('aria-label')
    page.set_viewport_size({'width':390,'height':844})
    assert card_a.locator('.app-icon').bounding_box()['width']==54
    assert card_b.locator('.app-icon').bounding_box()['width']==44
    page.set_viewport_size({'width':1024,'height':850})
    page.evaluate('setInstalled([])')
    page.wait_for_function('!v47Node.querySelector(".app-item").classList.contains("is-installed")')
    assert card_a.locator('.app-icon').bounding_box()['width']==56
    # Add using the real local star on the recent card; the existing star animation remains.
    page.locator('#homeApps .workspace-fav').click()
    assert page.evaluate('labels()') == ['A','B','C','D','E']
    assert page.evaluate('animations("E")[0][0].opacity') == '0'
    page.wait_for_timeout(350)
    # Remove via shared-storage event; ghost is inert, surviving cards slide.
    page.evaluate('window.originalB = document.querySelector(\'#homeWorkspaceApps > [data-label="B"]\'); setFavorites(["B","C","D","E"])')
    assert page.evaluate('labels()') == ['B','C','D','E']
    assert page.evaluate('originalB === document.querySelector(\'#homeWorkspaceApps > [data-label="B"]\')')
    assert page.locator('.favorite-exit-layer').get_attribute('aria-hidden') == 'true'
    assert page.locator('.favorite-exit-layer').evaluate('(e)=>e.inert')
    assert page.locator('.favorite-exit-layer [data-label="A"].app-card').count() == 1
    assert 'translate(' in page.evaluate('animations("B")[0][0].transform')
    # Duplicate refresh must preserve the active animation object.
    assert page.evaluate('''() => { const n=originalB, a=n.getAnimations()[0]; setFavorites(['B','C','D','E']); return a===n.getAnimations()[0]; }''')
    # A second removal should not drop the first exiting ghost prematurely.
    page.evaluate('setFavorites(["C","D","E"])')
    assert page.locator('.favorite-exit-layer > .app-card').count() == 2
    page.evaluate('setFavorites(["A","C","D","E"])')
    assert page.locator('.favorite-exit-layer > [data-label="A"]').count() == 0
    assert page.evaluate('labels()') == ['A','C','D','E']
    page.wait_for_timeout(400)
    assert page.locator('.favorite-exit-layer').count() == 0
    # Reordering moves existing nodes instead of re-creating them.
    page.evaluate('setFavorites(["E","A","C","D"])')
    assert page.evaluate('animations("E").length') == 1
    page.wait_for_timeout(350)
    # Last removal / first insertion include the empty hint.
    page.evaluate('setFavorites([])')
    assert page.locator('#homeWorkspaceApps > .home-empty').count() == 1
    page.wait_for_timeout(350)
    page.evaluate('setFavorites(["A"])')
    assert page.locator('.favorite-exit-layer > .home-empty').count() == 1
    page.wait_for_timeout(350)
    # Hidden search view does not replay missed animations when it is closed.
    page.locator('#homeSearchToggle').click()
    page.locator('#homeSearch').fill('e')
    page.evaluate('setFavorites(["A","B"])')
    page.locator('#homeSearchToggle').click()
    assert page.evaluate('labels()') == ['A','B']
    assert page.evaluate('animations("B").length') == 0
    # Reduced motion settles immediately and suppresses future animations.
    page.evaluate('setFavorites(["B"])')
    page.emulate_media(reduced_motion='reduce')
    page.wait_for_function('!document.querySelector(".favorite-exit-layer")')
    page.evaluate('setFavorites(["B","C"])')
    assert page.evaluate('animations("C").length') == 0
    # Local context-menu removal in a narrow, touch-sized viewport.
    page.emulate_media(reduced_motion='no-preference')
    page.set_viewport_size({'width':390,'height':844})
    page.wait_for_timeout(100)
    card=page.locator('#homeWorkspaceApps > [data-label="B"]')
    card.locator('.app-item').click(button='right')
    card.locator('.app-edit-more').click()
    card.get_by_role('button',name='Favorit entfernen',exact=True).click()
    assert page.evaluate('labels()') == ['C']
    assert page.locator('.favorite-exit-layer > [data-label="B"]').count() == 1
    page.wait_for_timeout(350)
    assert page.locator('.favorite-exit-layer').count() == 0
    # v46: real mouse hold reveals both controls before release; drop exits edit.
    page.evaluate('setFavorites(["B","C"])')
    page.wait_for_timeout(350)
    card=page.locator('#homeWorkspaceApps > [data-label="B"]')
    target=page.locator('#homeWorkspaceApps > [data-label="C"]')
    def center(locator):
        rect=locator.bounding_box()
        return rect['x']+rect['width']/2, rect['y']+rect['height']/2
    x,y=center(card.locator('.app-item'))
    page.mouse.move(x,y)
    page.mouse.down()
    page.wait_for_timeout(550)
    assert card.locator('.app-edit-more').is_visible()
    assert card.locator('.app-edit-exit').is_visible()
    page.mouse.up()
    assert card.locator('.app-edit-more').is_visible()
    card.locator('.app-edit-exit').click()
    assert card.locator('.app-edit-more').count()==0
    page.wait_for_timeout(200)
    x,y=center(card.locator('.app-item'))
    page.mouse.move(x,y)
    page.mouse.down()
    page.wait_for_timeout(550)
    assert card.locator('.app-edit-exit').is_visible()
    tx,ty=center(target.locator('.app-item'))
    page.mouse.move(tx,ty,steps=8)
    assert page.locator('.app-drag-ghost').count()==1
    page.mouse.up()
    assert page.evaluate('labels()') == ['C','B']
    assert page.locator('.app-drag-ghost, .app-card.is-editing, .app-edit-control').count()==0
    assert card.locator('.app-item').is_visible()
    # v45: real dropdown layout with a simulated browser install event.
    page.evaluate('''() => {
      const original=window.matchMedia.bind(window);
      window.installMode = new EventTarget();
      installMode.matches=false;
      window.matchMedia=query=>query==='(display-mode: standalone)'?installMode:original(query);
    }''')
    page.add_script_tag(content=(WS/'pwa.js').read_text())
    button=page.locator('#installWorkspace')
    help_text=page.locator('#installWorkspaceHelp')
    page.locator('#toolbarMenuToggle').click()
    assert button.is_visible() and not help_text.is_visible()
    assert button.evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgb(44, 212, 255)'
    assert button.evaluate('(e)=>getComputedStyle(e).color')=='rgb(10, 10, 12)'
    button.hover()
    assert button.evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgb(44, 212, 255)'
    button.click()
    assert help_text.is_visible() and button.get_attribute('aria-expanded')=='true'
    button.click()
    assert not help_text.is_visible()
    page.locator('#toolbarPositionToggle').click()
    page.wait_for_timeout(400)
    page.locator('#toolbarMenuToggle').click()
    assert page.locator('.toolbar-bottom').count()==1 and button.is_visible()
    button.click()
    assert help_text.is_visible()
    assert help_text.bounding_box()['y'] >= 0
    # A late native prompt replaces the manual hint and remains one-shot.
    page.evaluate('''() => {
      window.promptCalls=0;
      window.offerInstall=()=>{
        const e=new Event('beforeinstallprompt',{cancelable:true});
        e.prompt=()=>{promptCalls++;return new Promise(resolve=>window.finishPrompt=resolve)};
        e.userChoice=Promise.resolve({outcome:'dismissed'});
        window.dispatchEvent(e);
        return e.defaultPrevented;
      };
    }''')
    assert page.evaluate('offerInstall()')
    assert not help_text.is_visible()
    button.click()
    assert button.is_disabled() and page.evaluate('promptCalls')==1
    page.evaluate('finishPrompt()')
    page.wait_for_function('!document.getElementById("installWorkspace").disabled')
    button.click()
    assert help_text.is_visible() and page.evaluate('promptCalls')==1
    # Standalone mode hides the button and hint; a new native offer still works.
    page.evaluate('installMode.matches=true; installMode.dispatchEvent(new Event("change"))')
    assert not button.is_visible() and not help_text.is_visible()
    page.evaluate('installMode.matches=false; installMode.dispatchEvent(new Event("change"))')
    assert button.is_visible()
    assert page.evaluate('offerInstall()')
    button.click()
    page.evaluate('window.dispatchEvent(new Event("appinstalled")); finishPrompt()')
    assert not button.is_visible() and not help_text.is_visible()
    # v49: favorite toggle acts on the current app, not the selected group.
    favorite=page.locator('#favoriteApp')
    assert favorite.is_visible() and favorite.is_disabled()
    assert page.locator('.toolbar-menu-actions > :first-child').get_attribute('id')=='favoriteApp'
    page.locator('#toolbarMenuToggle').click()
    page.route('https://example.test/**', lambda route: route.fulfill(status=200,body='App'))
    page.locator('#homeWorkspaceApps > [data-label="B"] .app-item').click()
    page.wait_for_function('!document.getElementById("reloadApp").disabled')
    page.locator('#toolbarMenuToggle').click()
    assert favorite.is_enabled() and favorite.get_attribute('aria-pressed')=='true'
    assert favorite.locator('svg').evaluate('(e)=>getComputedStyle(e).fill')=='rgb(183, 160, 106)'
    favorite.click()
    assert favorite.is_visible() and favorite.get_attribute('aria-pressed')=='false'
    assert favorite.locator('svg').evaluate('(e)=>getComputedStyle(e).fill')=='none'
    favorite.click()
    assert favorite.get_attribute('aria-pressed')=='true'
    page.evaluate('setFavorites(["C"])')
    assert favorite.get_attribute('aria-pressed')=='false'
    favorite.click()
    assert favorite.get_attribute('aria-pressed')=='true'
    page.locator('#toolbarRecentApps .app-item[data-label="E"]').click()
    page.wait_for_function('!document.getElementById("reloadApp").disabled')
    page.locator('#toolbarMenuToggle').click()
    assert favorite.get_attribute('aria-pressed')=='false'
    assert favorite.get_attribute('aria-label').endswith(': E')
    favorite.click()
    assert favorite.get_attribute('aria-pressed')=='true'
    page.locator('#toolbarMenuToggle').click()
    page.locator('#homeApp').click()
    page.wait_for_function('labels().includes("E")')
    assert page.evaluate('labels()')==['C','B','E']
    page.locator('#toolbarMenuToggle').click()
    assert favorite.is_disabled() and favorite.get_attribute('aria-pressed')=='false'
    assert not errors, errors
    browser.close()
print('OK: real Chromium layout, local add, external remove/reorder, rapid changes, empty grid, hidden view, reduced motion, toolbar install and fallback, current-app favorite toggle and cross-tab sync.')
