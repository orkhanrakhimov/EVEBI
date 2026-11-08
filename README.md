# EVები (evebi.ge)

Independent Georgian EV media site. Plain HTML/CSS/JS on GitHub Pages. Georgian is the default language, English is switchable.

## Where things are
- `p-7f3k9x2m/` — the hidden full site (noindex). Root `index.html` is the public "coming soon" page.
- `src/pages/*.html` — page sources. **Edit these, then run `python3 src/build.py`** to regenerate the pages in `p-7f3k9x2m/`.
- `src/partials/` — shared header and footer.
- `p-7f3k9x2m/js/config.js` — phone, email, Instagram, audience numbers, form endpoint, media kit, portfolio projects.
- `p-7f3k9x2m/css/site.css` — design (colour tokens at the top).

## Editing text
Georgian text is written directly in the HTML. The English text sits in the `data-en="..."` attribute of the same element.

## Replacing photos
Drop JPG files into `p-7f3k9x2m/assets/img/` with these names and they replace the placeholders automatically:
`hero.jpg`, `portrait.jpg`, `collab.jpg`, `find.jpg`, `about-1.jpg`, `about-2.jpg`, `about-3.jpg`.

## Forms
Create a free form at formspree.io, paste its URL into `formEndpoint` in `js/config.js`. Until then forms do not pretend to send: they offer WhatsApp / email with the text prepared.

## Going live
In `src/build.py` set `NOINDEX = False`, rebuild, and move the built pages to the repo root (or point the domain at them).

Previous version (charging map) is in git history before commit "New site".
