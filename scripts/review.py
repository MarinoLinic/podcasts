"""Finite isolated Chrome QA. No user clipboard, microphone, or browser profile."""
import argparse
import json
import re
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
        assert page.locator('.note-row').count() == 113
        assert page.locator('#result-count').inner_text() == '113 notes'
        raw_tags=set()
        for source in (root/'notes').glob('*.md'):
            for value in re.findall(r'(?mi)^Tags:[ \t]*(.*)$',source.read_text(encoding='utf-8')):
                raw_tags.update(tag.strip() for tag in value.split(',') if tag.strip())
        assert set(page.locator('#tag option').evaluate_all('(nodes)=>nodes.map(node=>node.value).filter(Boolean)'))==raw_tags
        assert 'tfr' in raw_tags
        page.get_by_role('button',name='Open note navigation',exact=True).click()
        assert page.locator('#notes-navigation').is_visible()
        assert page.locator('.drawer-note').count()==113
        assert set(page.locator('.navigation-tags a').evaluate_all('(nodes)=>nodes.map(node=>node.dataset.tag)'))==raw_tags
        page.locator('.navigation-tags').get_by_role('link',name='TFR',exact=True).click()
        page.wait_for_selector('.note-row')
        if page.locator('#notes-navigation').is_visible():page.locator('.close-navigation').click()
        assert page.locator('#result-count').inner_text()=='5 notes'
        page.get_by_role('button',name='Reset filters').click()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), label+' library overflow'
        page.evaluate('window.scrollTo(0,0)')
        page.evaluate('document.fonts.ready')
        page.screenshot(path=str(args.out/f'{label}-library.png'))
        assert page.locator('.source-icon').count() == 113
        assert page.locator('.row-rating').count() == 113
        assert all('?' not in value for value in page.locator('.source-icon, .row-rating').all_text_contents())
        original_order = json.loads((root/'site/library-order.json').read_text(encoding='utf-8'))['entries']
        expected = [entry['filename'].removesuffix('.md').lower() for entry in original_order]
        expected = [re.sub('[^a-z0-9]+','-',name).strip('-') for name in expected]
        actual = page.locator('.note-title').evaluate_all('(links)=>links.map(link=>new URL(link.href).pathname.split("/").filter(Boolean).at(-1))')
        assert actual == expected, 'Homepage differs from the original sidebar order'
        drawer_order = page.locator('.drawer-note').evaluate_all('(links)=>links.map(link=>new URL(link.href).pathname.split("/").filter(Boolean).at(-1))')
        assert drawer_order == expected, 'Full drawer differs from the original sidebar order'
        page.locator('#search').fill('Burja')
        assert 'Samo Burja' in page.locator('.author-heading').all_text_contents()
        page.reload()
        page.wait_for_selector('.note-row')
        assert page.locator('#search').input_value() == 'Burja'
        assert page.locator('.note-row').count() >= 10
        page.get_by_role('button',name='Reset filters').click()
        page.locator('[data-type="book"]').click()
        assert page.locator('#result-count').inner_text() == '15 notes'
        page.locator('#search').fill('NO-RESULTS-EXACT-XYZ')
        assert page.get_by_text('No matching notes',exact=True).is_visible()
        page.get_by_role('button',name='Reset filters').click()
        page.locator('#search').fill('Why Europe Matters')
        page.locator('.note-title').first.click()
        assert '/notes/samo-burja-why-europe-matters-for-america-s-future/' in page.url
        assert page.locator('h1').count() == 1
        assert page.locator('.article-type-icon').get_attribute('aria-label')=='video'
        assert re.fullmatch(r'[\d,]+ words',page.locator('[data-word-count]').inner_text())
        body_words = len(re.findall(r'\S+',page.locator('.note-body').inner_text()))
        assert int(page.locator('[data-word-count]').inner_text().split()[0].replace(',','')) == body_words
        for name in ['Copy text','Copy Markdown']:
            assert page.get_by_role('button',name=name,exact=True).is_visible()
        for name in ['Download text','Download Markdown','Read transcript']:
            assert page.get_by_role('link',name=name,exact=True).is_visible()
        if label=='desktop':
            boxes=page.locator('.reader-actions .button').evaluate_all('(nodes)=>nodes.map(node=>{const r=node.getBoundingClientRect();return {top:r.top,height:r.height}})')
            assert len({round(box['top']) for box in boxes})==1
            assert len({round(box['height']) for box in boxes})==1
        assert page.locator('.note-body').inner_text().startswith('Samo Burja argues')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), label+' note overflow'
        page.evaluate('window.scrollTo(0,0)')
        page.evaluate('document.fonts.ready')
        page.screenshot(path=str(args.out/f'{label}-note.png'))
        page.get_by_role('button',name='Open note navigation',exact=True).click()
        assert page.locator('.drawer-note').count()==113
        page.screenshot(path=str(args.out/f'{label}-navigation.png'))
        assert page.locator('.navigation-author summary a').first.get_attribute('href').endswith('?author=Bryan%20Caplan')
        page.locator('.close-navigation').click()
        original = next((root/'notes').glob('Samo Burja - Why Europe Matters*')).read_text(encoding='utf-8')
        page.get_by_role('button',name='Copy Markdown',exact=True).click()
        page.wait_for_function('window.__copiedText?.startsWith("Summary:")')
        assert page.evaluate('window.__copiedText') == original
        page.get_by_role('button',name='Copy text',exact=True).click()
        page.wait_for_function('window.__copiedText?.startsWith("Samo Burja on")')
        readable = page.evaluate('window.__copiedText')
        assert 'Rating:' not in readable and '**' not in readable and 'Source: https://www.youtube.com/watch?v=bxDmHvGZtPQ' in readable
        for name,filename,expected in [('Download Markdown','source.md',original),('Download text','readable.txt',readable)]:
            with page.expect_download() as pending_download:
                page.get_by_role('link',name=name,exact=True).click()
            output=args.out/f'{label}-{filename}'
            pending_download.value.save_as(output)
            assert output.read_text(encoding='utf-8')==expected
            if name=='Download Markdown':
                assert output.read_bytes()==next((root/'notes').glob('Samo Burja - Why Europe Matters*')).read_bytes()
        # Replace the method inside our own stub, never the system clipboard.
        page.evaluate("() => { navigator.clipboard.writeText=async()=>{throw Error('denied')}; }")
        page.get_by_role('button',name='Copy Markdown',exact=True).click()
        page.wait_for_selector('.copy-dialog[open]')
        assert page.locator('.copy-dialog textarea').input_value() == original
        page.screenshot(path=str(args.out/f'{label}-clipboard-fallback.png'))
        page.get_by_role('button',name='Close',exact=True).click()
        page.get_by_role('link',name='Read transcript',exact=True).click()
        assert '/transcripts/bxDmHvGZtPQ/' in page.url
        assert page.locator('.note-body').inner_text().__len__() > 10000
        assert page.get_by_role('link',name='Watch on YouTube',exact=False).get_attribute('href') == 'https://www.youtube.com/watch?v=bxDmHvGZtPQ'
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), label+' transcript overflow'
        page.evaluate('window.scrollTo(0,0)')
        page.evaluate('document.fonts.ready')
        page.screenshot(path=str(args.out/f'{label}-transcript.png'))
        page.goto(base+'transcripts/')
        page.wait_for_selector('.note-row')
        assert page.locator('#result-count').inner_text() == '64 video sources'
        page.locator('#search').fill('Empire of Love')
        assert page.locator('.note-row').count() == 2
        assert all('/transcripts/' in href for href in page.locator('.note-title').evaluate_all('(nodes)=>nodes.map(n=>n.href)'))
        page.goto(base+'about/')
        page.evaluate('document.fonts.ready')
        page.screenshot(path=str(args.out/f'{label}-about.png'))
        assert not errors,errors
        results.append({'viewport':label,'width':width,'height':height,'notes':113,'transcripts':64,'search_filters_author_groups':True,'exact_legacy_order':True,'all_items_visible':True,'all_tags_including_tfr':True,'navigation_drawer':True,'article_icon_and_word_count':True,'real_text_markdown_downloads':True,'matching_action_controls':True,'query_reload':True,'direct_note_route':True,'exact_markdown_copy':True,'readable_copy':True,'clipboard_fallback':True,'caption_identity':True,'overflow':False,'page_errors':errors})
        context.close()
    browser.close()
(args.out/'checks.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps({'artifacts':str(args.out),'checks':results},indent=2))
