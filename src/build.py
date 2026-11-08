#!/usr/bin/env python3
"""Build static pages: python3 src/build.py
Reads src/pages/*.html (front matter + body) and src/partials/*.html,
writes finished pages into the site folder (OUT)."""
import os, re, html
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(ROOT), "p-7f3k9x2m")
NOINDEX = True                      # set False when the site goes live
SITE = "https://evebi.ge"           # used for canonical/og when live
VER = "2"                           # bump to bust the cache of css/js

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
<meta name="theme-color" content="#F5F5F2">
<link rel="icon" href="assets/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="preload" href="assets/fonts/LGV-Baxy-Regular.ttf" as="font" type="font/ttf" crossorigin>
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

def esc(s):
    return html.escape(s, quote=True)

pagesdir = os.path.join(ROOT, "pages")
for fn in sorted(os.listdir(pagesdir)):
    if not fn.endswith(".html"):
        continue
    page = fn[:-5]
    meta, body = parse(read(os.path.join(pagesdir, fn)))
    h = header.replace('data-nav="%s"' % page, 'data-nav="%s" aria-current="page"' % page)
    ld = '{"@context":"https://schema.org","@type":"WebSite","name":"EVები","url":"%s","inLanguage":["ka","en"]}' % SITE
    out = TEMPLATE.format(
        robots='<meta name="robots" content="noindex, nofollow">\n' if NOINDEX else "",
        title=esc(meta["title"]), desc=esc(meta["desc"]),
        title_en=esc(meta.get("title_en", meta["title"])), desc_en=esc(meta.get("desc_en", meta["desc"])),
        wa=esc(meta.get("wa", "")), wa_en=esc(meta.get("wa_en", "")),
        site=SITE, ver=VER, page=page, ld=ld, header=h, footer=footer, body=body)
    name = "index.html" if page == "home" else page + ".html"
    open(os.path.join(OUT, name), "w", encoding="utf-8").write(out)
    print("built", name)
