#!/usr/bin/env python3
"""Build static pages: python3 src/build.py
Reads src/pages/*.html (front matter + body) and src/partials/*.html,
writes finished pages into the site folder (OUT)."""
import os, re, html
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(ROOT)
NOINDEX = False                     # True = hide from search engines
SITE = "https://evebi.ge"           # used for canonical/og when live
VER = "60"
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
{alt}
<meta name="theme-color" content="#F5F5F2">
<link rel="icon" href="assets/favicon.png">
<link rel="preload" href="assets/fonts/Geist-var.woff" as="font" type="font/woff" crossorigin>
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


# ---------- EV Explained guides ----------
import math
def slug(t):
    t=re.sub(r"<[^>]+>","",t).lower()
    t=re.sub(r"[^a-z0-9]+","-",t).strip("-")
    return t or "section"

GUIDES = []
_pd = os.path.join(ROOT, "pages")
for _fn in sorted(os.listdir(_pd)):
    if not _fn.endswith(".html"):
        continue
    _m, _b = parse(read(os.path.join(_pd, _fn)))
    if _m.get("guide") == "yes":
        _words = len(re.sub(r"<[^>]+>", " ", _b).split())
        GUIDES.append(dict(slug=_fn[:-5], href=_fn, order=int(_m["order"]), topic=_m["topic"], kind=_m.get("kind", "Guide"),
                           h1=_m["h1"], lead=_m["lead"], points=[x.strip() for x in _m["points"].split("|")],
                           summary=_m.get("summary", ""), minutes=max(2, math.ceil(_words / 190)), body=_b))
GUIDES.sort(key=lambda g: g["order"])

def guide_page(g):
    i = GUIDES.index(g); n = len(GUIDES)
    ids = []; toc = []
    def addid(m):
        base = slug(m.group(1)); sid = base; k = 2
        while sid in ids:
            sid = "%s-%d" % (base, k); k += 1
        ids.append(sid); toc.append((sid, re.sub(r"<[^>]+>", "", m.group(1))))
        return '<h2 id="%s">%s</h2>' % (sid, m.group(1))
    prose = re.sub(r"<h2>(.*?)</h2>", addid, g["body"])
    toc_html = "".join('<li><a href="#%s">%s</a></li>' % (a, b) for a, b in toc)
    pts = "".join("<li>%s</li>" % esc(x) for x in g["points"])
    prev = GUIDES[i - 1] if i > 0 else None
    nxt = GUIDES[i + 1] if i < n - 1 else None
    def pager(gg, label, cls):
        if not gg:
            return '<span class="pg %s off"></span>' % cls
        return '<a class="pg %s" href="%s"><small>%s</small><b>%s</b></a>' % (cls, gg["href"], label, gg["h1"])
    return """<div class="progress" aria-hidden="true"><i></i></div>
<section class="hero art-hero">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="explained.html">EV Explained</a><span>/</span><span>%(topic)s</span></nav>
    <div class="art-meta"><span class="badge">%(kind)s %(num)d of %(n)d</span><span>%(min)d min read</span><span>General information · Updated November 2026</span></div>
    <h1 class="display art-title">%(h1)s</h1>
    <p class="lead art-lead">%(lead)s</p>
  </div>
</section>
<section class="sec art-sec">
  <div class="wrap art-layout">
    <aside class="toc"><div class="toc-in"><b>In this guide</b><ol>%(toc)s</ol><a class="toc-back" href="explained.html">← All guides</a></div></aside>
    <article class="prose">
      <details class="toc-m"><summary>In this guide</summary><ol>%(toc)s</ol></details>
      <div class="keypoints"><b>The short version</b><ul>%(pts)s</ul></div>
%(prose)s
    </article>
  </div>
</section>
<section class="sec sec-alt art-end">
  <div class="wrap">
    <nav class="pager" aria-label="Guide navigation">%(prev)s%(next)s</nav>
    <p class="art-all"><a class="link" href="explained.html">← Back to all guides</a></p>
  </div>
</section>
<section class="sec sec-dark">
  <div class="wrap split">
    <div><h2 class="h2">Still unsure? Ask me.</h2><p class="lead" style="margin-top:14px">Send your question, or tell me which car you're considering.</p></div>
    <div class="btns"><a class="btn btn-red" data-wa-link href="#" rel="noopener">Ask on WhatsApp</a><a class="btn btn-line" data-mail-link data-keep href="#">contact@evebi.ge</a></div>
  </div>
</section>""" % dict(topic=g["topic"], kind=g["kind"], num=i + 1, n=n, min=g["minutes"], h1=g["h1"], lead=esc(g["lead"]),
        toc=toc_html, pts=pts, prose=prose, prev=pager(prev, "← Previous", "prev"), next=pager(nxt, "Next →", "next"))

def hub_path():
    items = []
    for i, g in enumerate(GUIDES):
        items.append('<li class="gstep rv" data-topic="%s" data-slug="%s"><a href="%s"><span class="gstep-n">%d</span><span class="gstep-b"><span class="gstep-meta">%s · %d min read<em class="read"> · Read</em></span><b>%s</b><span class="gstep-s">%s</span></span><span class="gstep-go" aria-hidden="true">→</span></a></li>'
                     % (g["topic"], g["slug"], g["href"], i + 1, g["kind"] if g["kind"] == "Checklist" else g["topic"], g["minutes"], g["h1"], esc(g["summary"])))
    return '<ol class="path">' + "".join(items) + '</ol>'


# ---------- Georgian version (text comes from src/i18n_ka.json) ----------
import json
KA = json.load(open(os.path.join(ROOT, "i18n_ka.json"), encoding="utf-8"))
KA_PAGES = {"home": "index.html", "about": "about.html", "collaborations": "collaborations.html", "contact": "contact.html", "explained": "explained.html"}
KA_MISSING = []

def lang_switch(page, cur):
    en = "/" if page == "home" else "/" + page
    ka_ = ("/ka/" if page == "home" else "/ka/" + page) if page in KA_PAGES else "/ka/"
    def a(code, label, href, name):
        return '<a href="%s" hreflang="%s" lang="%s" aria-label="%s"%s>%s</a>' % (href, code, code, name, ' aria-current="true"' if cur == code else "", label)
    return '<div class="lang" role="group" aria-label="Language">' + a("ka", "ქარ", ka_, "ქართული") + a("en", "EN", en, "English") + '</div>'

def to_ka(out, page, meta_en, strings):
    k = KA["meta"][KA_PAGES[page]]
    def tr(m):
        raw = m.group(1)
        t = re.sub(r"\s+", " ", html.unescape(raw)).strip()
        if t in strings:
            lead = raw[:len(raw) - len(raw.lstrip())]; trail = raw[len(raw.rstrip()):]
            return ">" + lead + html.escape(strings[t], quote=False) + trail + "<"
        if re.search(r"[A-Za-z]{3,}", t) and t not in ("TikTok", "WhatsApp", "Instagram", "contact@evebi.ge", "EVebi", "@ev.ebi") and not t.startswith(("document.", "{")):
            KA_MISSING.append((page, t))
        return m.group(0)
    out = out.replace(esc(meta_en["title_en"].replace("EVები", "EVebi")), esc(k["title"])).replace(esc(meta_en["desc_en"].replace("EVები", "EVebi")), esc(k["desc"]))
    out = re.sub(r">([^<>]+)<", tr, out)
    def attr(m):
        v = html.unescape(m.group(2))
        return '%s="%s"' % (m.group(1), esc(strings[v])) if v in strings else m.group(0)
    out = re.sub(r'\b(data-alt|placeholder|aria-label)="([^"]*)"', attr, out)
    out = re.sub(r'<link rel="canonical" href="%s/([^"]*)">' % re.escape(SITE), lambda m: '<link rel="canonical" href="%s/ka/%s">' % (SITE, m.group(1)), out)
    out = re.sub(r'data-wa="[^"]*"', 'data-wa="%s"' % esc(k["wa"]), out, count=1)
    out = out.replace('<html lang="en">', '<html lang="ka">').replace('content="EVebi"', 'content="EVები"').replace('"name":"EVebi"', '"name":"EVები"')
    out = out.replace('<meta property="og:type" content="website">', '<meta property="og:type" content="website">\n<meta property="og:locale" content="ka_GE">', 1)
    # links: translated pages stay in /ka/, the rest (guides, privacy) go to the English pages
    def lk(m):
        path, frag = m.group(1), m.group(2) or ""
        name = "home" if path == "" else path
        return 'href="%s%s"' % (("/ka/" + path) if name in KA_PAGES else "/" + path, frag)
    out = re.sub(r'href="/([a-z0-9-]*)(#[^"]*)?"', lk, out)
    out = re.sub(r'\b(href|src|data-src)="((?:assets|css|js)/)', r'\1="/\2', out)
    out = out.replace('href="https://evebi.ge/', 'href="https://evebi.ge/')
    return out

SITEMAP = []
def _alts(page):
    if page not in KA_PAGES:
        return ""
    u = "" if page == "home" else page
    return ('<link rel="alternate" hreflang="en" href="%s/%s">\n<link rel="alternate" hreflang="ka" href="%s/ka/%s">\n<link rel="alternate" hreflang="x-default" href="%s/%s">'
            % (SITE, u, SITE, u, SITE, u))
ALT = {p: _alts(p) for p in KA_PAGES}
pagesdir = os.path.join(ROOT, "pages")
for fn in sorted(os.listdir(pagesdir)):
    if not fn.endswith(".html"):
        continue
    page = fn[:-5]
    meta, body = parse(read(os.path.join(pagesdir, fn)))
    if meta.get("guide") == "yes":
        body = guide_page(next(x for x in GUIDES if x["slug"] == page))
    body = body.replace("<!--PATH-->", hub_path())
    navkey = meta.get("nav", page)
    h = header.replace('data-nav="%s"' % navkey, 'data-nav="%s" aria-current="page"' % navkey)
    ld = ('{"@context":"https://schema.org","@graph":['
          '{"@type":"Organization","@id":"%s/#org","name":"EVები","url":"%s/","logo":"%s/assets/logo-light.png",'
          '"email":"contact@evebi.ge",'
          '"sameAs":["https://www.tiktok.com/@ev.ebi","https://www.instagram.com/ev.ebi/"]},'
          '{"@type":"WebSite","name":"EVები","url":"%s/","inLanguage":%s,"publisher":{"@id":"%s/#org"}}]}'
          % (SITE, SITE, SITE, SITE, '["en"]' if EN_ONLY else '["ka","en"]', SITE))
    out = TEMPLATE.format(
        robots='<meta name="robots" content="noindex, nofollow">\n' if NOINDEX else "",
        title=esc(meta["title_en"] if EN_ONLY else meta["title"]), desc=esc(meta["desc_en"] if EN_ONLY else meta["desc"]),
        title_en=esc(meta.get("title_en", meta["title"])), desc_en=esc(meta.get("desc_en", meta["desc"])),
        wa=esc(meta.get("wa_en", "") if EN_ONLY else meta.get("wa", "")), wa_en=esc(meta.get("wa_en", "")),
        file=("" if page == "home" else page), alt=ALT.get(page, ""), site=SITE, ver=VER, page=page, ld=ld, header=h, footer=footer, body=body)
    if EN_ONLY:
        out = re.sub(r'(<input type="radio" name="\w+" value=")[^"]*("[^>]*><span data-en=")([^"]*)(")', lambda m: m.group(1)+m.group(3)+m.group(2)+m.group(3)+m.group(4), out)
        out = re.sub(r'placeholder="[^"]*"\s+data-en-ph="([^"]*)"', r'placeholder="\1"', out)
        out = to_en(out)
        out = out.replace('<html lang="ka">', '<html lang="en">')
        out = out.replace('<span class="logo-ka">ები</span>', '<span class="logo-ka">ebi</span>').replace("EVები", "EVebi")
        out = re.sub(r'\sdata-(title-en|desc-en|wa-en)="[^"]*"', "", out)
    out = re.sub(r'<span>→</span>', '<span class="arr"></span>', out)
    out = re.sub(r'<span>↗</span>', '<span class="arr arr-up"></span>', out)
    out = re.sub(r'\s*→(?=</a>)', ' <span class="arr"></span>', out)
    out = re.sub(r'(<a class="link[^>]*>)\s*← ', r'\1<span class="arr arr-back"></span> ', out)
    out = out.replace('<span class="arr">→</span>', '<span class="arr"></span>')
    # clean URLs: /about instead of about.html, / instead of index.html
    out = re.sub(r'href="index\.html(#[^"]*)?"', lambda m: 'href="/%s"' % (m.group(1) or ""), out)
    out = re.sub(r'href="([a-z0-9-]+)\.html(#[^"]*)?"', lambda m: 'href="/%s%s"' % (m.group(1), m.group(2) or ""), out)
    if page == "404":
        out = out.replace('<meta name="viewport" content="width=device-width, initial-scale=1">', '<meta name="viewport" content="width=device-width, initial-scale=1">\n<base href="/">\n<meta name="robots" content="noindex">', 1)
    name = "index.html" if page == "home" else page + ".html"
    if meta.get("sitemap", "yes") != "no":
        SITEMAP.append("" if page == "home" else page)
        if page in KA_PAGES:
            SITEMAP.append("ka/" if page == "home" else "ka/" + page)
    en_out = out.replace("<!--LANG-->", lang_switch(page, "en"))
    open(os.path.join(OUT, name), "w", encoding="utf-8").write(en_out)
    print("built", name)
    if page in KA_PAGES:
        os.makedirs(os.path.join(OUT, "ka"), exist_ok=True)
        ka_out = to_ka(out, page, meta, KA["strings"]).replace("<!--LANG-->", lang_switch(page, "ka"))
        open(os.path.join(OUT, "ka", name), "w", encoding="utf-8").write(ka_out)
        print("built ka/" + name)

sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join('  <url><loc>%s/%s</loc></url>\n' % (SITE, u) for u in sorted(SITEMAP)) + '</urlset>\n'
open(os.path.join(OUT, "sitemap.xml"), "w", encoding="utf-8").write(sm)

if KA_MISSING:
    print("\nGeorgian: English text still on the page (add to src/i18n_ka.json):")
    for pg, t in KA_MISSING:
        print("  [%s] %s" % (pg, t[:90]))
