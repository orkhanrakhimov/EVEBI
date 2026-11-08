# EVები (evebi.ge)

Independent Georgian EV media site. Plain HTML/CSS/JS on GitHub Pages. Georgian is the default language, English is switchable.

## Where things are
- Repo root, the live site (built pages, `css/`, `js/`, `assets/`).
- `src/pages/*.html`, page sources. **Edit these, then run `python3 src/build.py`** to regenerate the pages at the repo root.
- `src/partials/`, shared header and footer.
- `js/config.js`, phone, email, Instagram, audience numbers, form endpoint, media kit, portfolio projects.
- `css/site.css`, design (colour tokens at the top).

## Editing text
Georgian text is written directly in the HTML. The English text sits in the `data-en="..."` attribute of the same element.

## Replacing photos
Drop JPG files into `assets/img/` with these names and they replace the placeholders automatically:
`hero.jpg`, `portrait.jpg`, `collab.jpg`, `find.jpg`, `about-1.jpg`, `about-2.jpg`, `about-3.jpg`.

## Forms
Create a free form at formspree.io, paste its URL into `formEndpoint` in `js/config.js`. Until then forms do not pretend to send: they offer WhatsApp / email with the text prepared.

Previous version (charging map) is in git history before commit "New site".

## Language
The site is currently published in English only (`EN_ONLY = True` in `src/build.py`, `languages: ["en"]` in `js/config.js`). The Georgian text is kept in `src/pages/` next to each English string. To bring it back after corrections: set `EN_ONLY = False`, set `languages: ["ka","en"]`, run `python3 src/build.py`.

## Content you maintain (all in `js/config.js`)
- `projects`, Selected Work (title, category, one-line text, TikTok link, thumbnail in `assets/img/`).
- `cars`, car profiles (`car.html?id=...`). Add confirmed `specs` only.
- `dealerships`, dealership directory and profiles (`dealership.html?id=...`). Only verified information.
- `stats`, audience numbers; an empty value hides that figure.
Guides live in `src/pages/explained-*.html`. Revised sections (home, about, collaborations, work, cars, dealerships, guides) are English-only for now; Georgian versions to be added.
