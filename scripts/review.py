"""Finite isolated Chrome QA. No user clipboard, microphone, or browser profile."""
import argparse
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True
parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:4175/podcasts/')
parser.add_argument('--out', required=True, type=Path)
args = parser.parse_args()
args.out.mkdir(parents=True, exist_ok=True)
base = args.url.rstrip('/') + '/'
root = Path(__file__).resolve().parents[1]
results = []
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome')
    for label, width, height in [('desktop',1440,1000),('phone',390,844)]:
        context = browser.new_context(viewport={'width':width,'height':height}, device_scale_factor=1)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.add_init_script("Object.defineProperty(navigator,'clipboard',{value:{writeText:async(value)=>{window.__copiedText=value;}}});")
        page.goto(base)
        page.wait_for_selector('.note-row')
        assert page.locator('.note-row').count() == 24
        assert page.locator('#result-count').inner_text() == '113 notes'
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), label+' library overflow'
        page.screenshot(path=str(args.out/f'{label}-library.png'))
        page.get_by_role('button',name='Next',exact=False).click()
        assert 'page=2' in page.url
        assert page.locator('.note-row').count() == 24
        page.reload()
        page.wait_for_selector('.note-row')
        assert 'Page 2 of 5' in page.locator('#pagination').inner_text()
        page.locator('#search').fill('Burja')
        assert 'Burja' in page.locator('.row-author').first.inner_text()
        assert 'page=2' not in page.url
        assert page.locator('.note-row').count() >= 10
        page.get_by_role('button',name='Reset filters').click()
        page.locator('[data-type="book"]').click()
        assert page.locator('#result-count').inner_text() == '15 notes'
        page.locator('#search').fill('NO-RESULTS-EXACT-XYZ')
        assert page.get_by_text('No matching notes',exact=True).is_visible()
        page.get_by_role('button',name='Reset filters').click()
        page.locator('#search').fill('Why Europe Matters')
        page.locator('.row-content h2 a').first.click()
        assert '/notes/samo-burja-why-europe-matters-for-america-s-future/' in page.url
        assert page.locator('h1').count() == 1
        assert page.locator('.note-body').inner_text().startswith('Samo Burja argues')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), label+' note overflow'
        page.screenshot(path=str(args.out/f'{label}-note.png'))
        original = next((root/'notes').glob('Samo Burja - Why Europe Matters*')).read_text(encoding='utf-8')
        page.get_by_role('button',name='Copy Markdown',exact=True).click()
        page.wait_for_function('window.__copiedText?.startsWith("Summary:")')
        assert page.evaluate('window.__copiedText') == original
        page.get_by_role('button',name='Copy text',exact=True).click()
        page.wait_for_function('window.__copiedText?.startsWith("Samo Burja on")')
        readable = page.evaluate('window.__copiedText')
        assert 'Rating:' not in readable and '**' not in readable and 'Source: https://www.youtube.com/watch?v=bxDmHvGZtPQ' in readable
        # Replace the method inside our own stub, never the system clipboard.
        page.evaluate("() => { navigator.clipboard.writeText=async()=>{throw Error('denied')}; }")
        page.get_by_role('button',name='Copy Markdown',exact=True).click()
        page.wait_for_selector('.copy-dialog[open]')
        assert page.locator('.copy-dialog textarea').input_value() == original
        page.get_by_role('button',name='Close',exact=True).click()
        page.get_by_role('link',name='Read transcript',exact=True).click()
        assert '/transcripts/bxDmHvGZtPQ/' in page.url
        assert page.locator('.note-body').inner_text().__len__() > 10000
        assert page.get_by_role('link',name='Watch on YouTube',exact=False).get_attribute('href') == 'https://www.youtube.com/watch?v=bxDmHvGZtPQ'
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), label+' transcript overflow'
        page.screenshot(path=str(args.out/f'{label}-transcript.png'))
        page.goto(base+'transcripts/')
        page.wait_for_selector('.note-row')
        assert page.locator('#result-count').inner_text() == '64 video sources'
        page.locator('#search').fill('Empire of Love')
        assert page.locator('.note-row').count() == 2
        assert all('/transcripts/' in href for href in page.locator('.row-content h2 a').evaluate_all('(nodes)=>nodes.map(n=>n.href)'))
        assert not errors,errors
        results.append({'viewport':label,'width':width,'height':height,'notes':113,'transcripts':64,'search_filters_pagination':True,'query_reload':True,'direct_note_route':True,'exact_markdown_copy':True,'readable_copy':True,'clipboard_fallback':True,'caption_identity':True,'overflow':False,'page_errors':errors})
        context.close()
    browser.close()
(args.out/'checks.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps({'artifacts':str(args.out),'checks':results},indent=2))
