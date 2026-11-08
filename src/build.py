#!/usr/bin/env python3
"""Build static pages: python3 src/build.py
Reads src/pages/*.html (front matter + body) and src/partials/*.html,
writes finished pages into the site folder (OUT)."""
import os, re, html
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(ROOT)
NOINDEX = False                     # True = hide from search engines
SITE = "https://evebi.ge"           # used for canonical/og when live
VER = "27"
EN_ONLY = True                      # True = publish English only (Georgian text stays in src/ and returns when set to False)                           # bump to bust the cache of css/js

def read(p):
    return open(p, encoding="utf-8").read()

header = read(os.path.join(ROOT, "partials", "header.html"))
footer = read(os.path.join(ROOT, "partials", "footer.html"))

TEMPLATE = """<!doctype html>
<html lang="ka">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
{robots}<title>{title}</title>
<meta name="description" content="{desc}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="EVები">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{site}/assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="{site}/{file}">
<meta name="theme-color" content="#F5F5F2">
<link rel="icon" href="assets/favicon.png">
<link rel="preload" href="assets/fonts/Inter-var.woff" as="font" type="font/woff" crossorigin>
<link rel="stylesheet" href="css/site.css?v={ver}">
<script>document.documentElement.classList.add('js')</script>
<script type="application/ld+json">{ld}</script>
</head>
<body data-page="{page}" data-wa="{wa}" data-wa-en="{wa_en}" data-title-en="{title_en}" data-desc-en="{desc_en}">
<a class="skip" href="#main" data-en="Skip to content">მთავარ შინაარსზე გადასვლა</a>
{header}
<main id="main">
{body}
</main>
{footer}
<script src="js/config.js?v={ver}"></script>
<script src="js/app.js?v={ver}"></script>
</body>
</html>
"""

def parse(src):
    head, _, body = src.partition("\n---\n")
    meta = {}
    for line in head.strip().splitlines():
        k, _, v = line.partition(":")
        meta[k.strip()] = v.strip()
    return meta, body.strip()


import html as _h
VOID = set()
def _close(src, tag, pos):
    """index just after the matching </tag> for an element whose content starts at pos"""
    depth, i = 1, pos
    rx = re.compile(r"<(/?)%s\b[^>]*?>" % tag)
    while True:
        m = rx.search(src, i)
        if not m:
            return None
        depth += -1 if m.group(1) else 1
        if depth == 0:
            return m
        i = m.end()

def to_en(src):
    """Replace content of every element carrying data-en with its English text."""
    out, pos = [], 0
    rx = re.compile(r'<(\w+)([^>]*?)\sdata-en="([^"]*)"([^>]*)>')
    while True:
        m = rx.search(src, pos)
        if not m:
            out.append(src[pos:]); break
        tag, a, en, b = m.groups()
        out.append(src[pos:m.start()])
        if tag == "option":
            a2 = re.sub(r'\svalue="[^"]*"', "", a + b)
            val = ' value=""' if 'value=""' in (a + b) else ' value="%s"' % en
            out.append("<option%s%s>" % (val, a2))
        else:
            out.append("<%s%s%s>" % (tag, a, b))
        c = _close(src, tag, m.end())
        if c is None:
            pos = m.end(); continue
        out.append(en)
        out.append(src[c.start():c.end()])
        pos = c.end()
    res = "".join(out)
    # radio values -> English (value attr followed by span data-en already replaced; handle before replace)
    return res

def esc(s):
    return html.escape(s, quote=True)

SITEMAP = []
pagesdir = os.path.join(ROOT, "pages")
for fn in sorted(os.listdir(pagesdir)):
    if not fn.endswith(".html"):
        continue
    page = fn[:-5]
    meta, body = parse(read(os.path.join(pagesdir, fn)))
    navkey = meta.get("nav", page)
    h = header.replace('data-nav="%s"' % navkey, 'data-nav="%s" aria-current="page"' % navkey)
    ld = '{"@context":"https://schema.org","@type":"WebSite","name":"EVები","url":"%s","inLanguage":["ka","en"]}' % SITE
    out = TEMPLATE.format(
        robots='<meta name="robots" content="noindex, nofollow">\n' if NOINDEX else "",
        title=esc(meta["title_en"] if EN_ONLY else meta["title"]), desc=esc(meta["desc_en"] if EN_ONLY else meta["desc"]),
        title_en=esc(meta.get("title_en", meta["title"])), desc_en=esc(meta.get("desc_en", meta["desc"])),
        wa=esc(meta.get("wa_en", "") if EN_ONLY else meta.get("wa", "")), wa_en=esc(meta.get("wa_en", "")),
        file=("" if page == "home" else page + ".html"), site=SITE, ver=VER, page=page, ld=ld, header=h, footer=footer, body=body)
    if EN_ONLY:
        out = re.sub(r'(<input type="radio" name="\w+" value=")[^"]*("[^>]*><span data-en=")([^"]*)(")', lambda m: m.group(1)+m.group(3)+m.group(2)+m.group(3)+m.group(4), out)
        out = re.sub(r'placeholder="[^"]*"\s+data-en-ph="([^"]*)"', r'placeholder="\1"', out)
        out = to_en(out)
        out = re.sub(r'<div class="lang".*?</div>', "", out, flags=re.S)
        out = out.replace('<html lang="ka">', '<html lang="en">')
        out = out.replace('<span class="logo-ka">ები</span>', '<span class="logo-ka">ebi</span>').replace("EVები", "EVebi")
        out = re.sub(r'\sdata-(title-en|desc-en|wa-en)="[^"]*"', "", out)
    name = "index.html" if page == "home" else page + ".html"
    if meta.get("sitemap", "yes") != "no":
        SITEMAP.append("" if page == "home" else page + ".html")
    open(os.path.join(OUT, name), "w", encoding="utf-8").write(out)
    print("built", name)

sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join('  <url><loc>%s/%s</loc></url>\n' % (SITE, u) for u in sorted(SITEMAP)) + '</urlset>\n'
open(os.path.join(OUT, "sitemap.xml"), "w", encoding="utf-8").write(sm)
