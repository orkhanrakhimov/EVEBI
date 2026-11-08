# EVები (evebi.ge)

Independent Georgian EV media site. Plain HTML/CSS/JS on GitHub Pages. Georgian is the default language, English is switchable.

## Where things are
- Repo root, the live site (built pages, `css/`, `js/`, `assets/`).
- `src/pages/*.html`, page sources. **Edit these, then run `python3 src/build.py`** to regenerate the pages at the repo root.
- `src/partials/`, shared header and footer.
- `js/config.js`: phone, email, TikTok, Instagram, media kit.
- `css/site.css`, design (colour tokens at the top).

## Editing text
Georgian text is written directly in the HTML. The English text sits in the `data-en="..."` attribute of the same element.

## Photos
Hero: `assets/img/hero.jpg`. About page: `assets/img/about.jpg`.

There are no forms: visitors contact EVebi through the WhatsApp and email buttons.

Previous version (charging map) is in git history before commit "New site".

## Language
The site is currently published in English only (`EN_ONLY = True` in `src/build.py`, `languages: ["en"]` in `js/config.js`). The Georgian text is kept in `src/pages/` next to each English string. To bring it back after corrections: set `EN_ONLY = False`, set `languages: ["ka","en"]`, run `python3 src/build.py`.

## Settings (`js/config.js`)
Guides live in `src/pages/explained-*.html`. Revised sections (home, about, collaborations, guides) are English-only for now; Georgian versions to be added.
