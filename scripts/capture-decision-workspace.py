"""Bounded UI check/capture against an already running dashboard preview.

Requires the existing Python Playwright installation. Does not start servers,
send chat messages, apply operational settings, or change source data.
"""
from pathlib import Path
import argparse
import json
import re
from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:5177')
    parser.add_argument('--output', default='docs/validation/dutch-decision-ux')
    args = parser.parse_args()
    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    report = {'url': args.url, 'observations': [], 'failures': [], 'page_errors': [], 'http_errors': []}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-proxy-server'])
        page = browser.new_page(viewport={'width': 1440, 'height': 1050})
        page.set_default_timeout(12000)
        page.on('pageerror', lambda error: report['page_errors'].append(str(error)))
        page.on('response', lambda response: report['http_errors'].append({'status': response.status, 'url': response.url}) if response.status >= 400 and '127.0.0.1' in response.url else None)

        def run(name, callback):
            try:
                detail = callback()
                report['observations'].append({'name': name, 'result': 'pass', 'detail': detail})
                print('PASS', name, flush=True)
            except Exception as error:
                report['failures'].append({'name': name, 'error': str(error)})
                page.screenshot(path=str(out / (name + '-failure.png')))
                print('FAIL', name, str(error)[:260], flush=True)

        def capture(name):
            page.evaluate('scrollTo(0,0)')
            page.wait_for_timeout(350)
            data = page.evaluate('''() => ({
              viewport: innerWidth, bodyWidth: document.documentElement.scrollWidth,
              title: document.querySelector('h1')?.innerText,
              primary: getComputedStyle(document.documentElement).getPropertyValue('--sg-color-primary').trim(),
              background: getComputedStyle(document.body).backgroundColor,
              activeNav: [...document.querySelectorAll('nav a[aria-current="page"]')].map(e=>e.innerText),
              overflow: [...document.querySelectorAll('main *, [role="dialog"] *')].filter(e=>{
                const r=e.getBoundingClientRect(); const s=getComputedStyle(e);
                return r.width>0 && (r.right>innerWidth+2 || r.left < -2) && s.position!=='absolute' && s.position!=='fixed';
              }).slice(0,8).map(e=>({tag:e.tagName,text:e.innerText?.slice(0,90),className:e.className}))
            })''')
            page.screenshot(path=str(out / (name + '.png')))
            (out / (name + '-dom.txt')).write_text(page.locator('body').inner_text(), encoding='utf-8')
            assert data['bodyWidth'] <= data['viewport'] + 2, json.dumps(data, ensure_ascii=False)
            assert page.locator('vite-error-overlay').count() == 0, 'Vite compilation error overlay'
            return data

        def navigate(route):
            nav = page.get_by_role('navigation', name=re.compile('PhytoSync'))
            link = nav.locator(f'a[href="{route}"]').last
            if not link.is_visible():
                nav.locator('button[aria-expanded]').first.click()
            link.click()
            page.wait_for_url(re.compile(re.escape(route) + r'(?:[#?].*)?$'))
            page.wait_for_timeout(900)
            assert nav.locator(f'a[href="{route}"][aria-current="page"]').count() == 1

        page.goto(args.url + '/overview', wait_until='domcontentloaded', timeout=45000)
        page.get_by_role('heading', name=re.compile('경북대 온실')).first.wait_for()
        page.wait_for_timeout(2500)

        def overview_desktop():
            assert page.get_by_text('데모 시뮬레이션', exact=True).count() > 0
            assert page.locator('canvas').count() > 0
            result = capture('after-overview-desktop')
            page.screenshot(path=str(out / 'after-overview-full.png'), full_page=True)
            return result
        run('overview-desktop', overview_desktop)

        def overview_tabs():
            result = []
            for tab_id in ['overview-dashboard', 'overview-watch', 'overview-core']:
                page.locator(f'a[href="#{tab_id}"]').click()
                page.wait_for_timeout(500)
                assert page.locator(f'a[href="#{tab_id}"][aria-selected="true"]').count() == 1
                assert page.locator('.overview-site-header h1').inner_text() == '경북대 온실'
                result.append(capture('after-' + tab_id))
            return result
        run('overview-tabs', overview_tabs)

        def crop_switch():
            for label in ['토마토', '오이']:
                button = page.get_by_role('button', name=label, exact=True)
                button.click()
                page.wait_for_timeout(600)
                assert button.get_attribute('aria-pressed') == 'true'
            return 'Both crop buttons select their actual state.'
        run('crop-switch', crop_switch)

        def drawer():
            trigger = page.get_by_role('button', name='질문 도우미 열기', exact=True)
            trigger.click()
            dialog = page.get_by_role('dialog', name='질문 도우미', exact=True)
            dialog.wait_for()
            assert page.evaluate('document.body.style.overflow') == 'hidden'
            close = dialog.get_by_role('button', name='닫기', exact=True)
            close.focus()
            page.keyboard.press('Shift+Tab')
            assert dialog.evaluate('(e)=>e.contains(document.activeElement)')
            page.keyboard.press('Tab')
            assert close.evaluate('(e)=>e===document.activeElement')
            question = dialog.get_by_role('textbox', name='질문 입력')
            question.fill('야간 습도 관리의 판단 기준')
            assert question.input_value() == '야간 습도 관리의 판단 기준'
            page.screenshot(path=str(out / 'after-assistant-drawer.png'))
            page.keyboard.press('Escape')
            assert page.get_by_role('dialog').count() == 0
            assert trigger.evaluate('(e)=>e===document.activeElement')
            trigger.click()
            page.mouse.click(20, 500)
            assert page.get_by_role('dialog').count() == 0
            return 'Open, focus cycle, draft input, Escape, focus restore and backdrop close.'
        run('assistant-drawer', drawer)

        def desktop_routes():
            results = []
            for route in ['/control', '/trend', '/scenarios', '/assistant']:
                navigate(route)
                results.append(capture('after-' + route[1:] + '-desktop'))
            return results
        run('desktop-routes', desktop_routes)

        def assistant_panels():
            page.get_by_role('button', name='자료 찾기', exact=True).first.click()
            page.wait_for_timeout(800)
            assert page.locator('body').inner_text().find('자료') >= 0
            capture('after-materials-desktop')
            page.get_by_role('button', name='질문', exact=True).first.click()
            page.get_by_role('textbox', name='질문 입력').wait_for(state='visible')
            return 'Materials and question panels remain reachable.'
        run('assistant-panels', assistant_panels)

        def locale_switch():
            page.get_by_role('button', name='EN', exact=True).click()
            page.get_by_role('textbox', name='Your question').wait_for()
            page.get_by_role('button', name='한국어', exact=True).click()
            page.get_by_role('textbox', name='질문 입력').wait_for()
            return 'English and Korean controls update the app.'
        run('locale-switch', locale_switch)

        for width in [768, 390]:
            def responsive(width=width):
                page.set_viewport_size({'width': width, 'height': 950 if width == 768 else 844})
                results = []
                for route in ['/overview', '/control', '/trend', '/scenarios', '/assistant']:
                    navigate(route)
                    results.append(capture(f'after-{route[1:]}-{width}'))
                return results
            run(f'responsive-{width}', responsive)

        def mobile_drawer():
            navigate('/overview')
            page.get_by_role('button', name='질문 도우미 열기', exact=True).click()
            dialog = page.get_by_role('dialog', name='질문 도우미', exact=True)
            dialog.wait_for()
            result = capture('after-assistant-drawer-390')
            field = dialog.get_by_role('textbox', name='질문 입력')
            field.wait_for(state='visible')
            geometry = field.evaluate('''e=>{
              const r=e.getBoundingClientRect();
              return {padding:getComputedStyle(document.querySelector('.assistant-drawer-surface')).padding,
                bottom:r.bottom,viewport:innerHeight,unclipped:document.elementFromPoint(r.x+r.width/2,r.bottom-3)===e};
            }''')
            assert geometry['unclipped'] and geometry['bottom'] <= geometry['viewport'], json.dumps(geometry)
            result['composer'] = geometry
            dialog.get_by_role('button', name='닫기', exact=True).click()
            return result
        run('mobile-drawer', mobile_drawer)
        browser.close()

    (out / 'browser-results.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'failures': report['failures'], 'page_errors': report['page_errors'], 'http_error_count': len(report['http_errors'])}, ensure_ascii=False), flush=True)
    return 1 if report['failures'] or report['page_errors'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
