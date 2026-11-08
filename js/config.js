/* ====== EVები — easy settings. Edit values here; no other file needed. ====== */
window.EVEBI = {
  // Site languages. Currently English only; use ["ka","en"] once the Georgian text is corrected.
  languages: ["en"],

  // Contact
  whatsapp: "995595606670",          // digits only, with country code
  email: "contact@evebi.ge",
  tiktok: "https://www.tiktok.com/@ev.ebi",
  instagram: "",                      // paste the official Instagram link; empty = hidden

  // Audience numbers (shown on the home page). Update when they change.
  stats: {
    followers: "1,100+",
    videos: "6",
    views: { ka: "ასობით ათასი", en: "Hundreds of thousands" },
    asOf: { ka: "2026 წლის ნოემბრის მონაცემებით", en: "As of November 2026" }
  },

  // Forms. Create a free form at https://formspree.io (or any service that accepts
  // a JSON POST), paste its endpoint here, e.g. "https://formspree.io/f/abcdwxyz".
  // While empty, forms do NOT pretend to send: they offer WhatsApp / email instead.
  formEndpoint: "",

  // Media kit: put the PDF in assets/ and paste its path, e.g. "assets/evebi-media-kit.pdf".
  // While empty the download button is not shown.
  mediaKit: "",

  // Selected work. Add real projects only. Example:
  // { title:{ka:"BYD Seal — 24 საათი",en:"BYD Seal — 24 hours"}, type:{ka:"მიმოხილვა",en:"Review"},
  //   text:{ka:"...",en:"..."}, image:"assets/img/work-1.jpg", link:"https://www.tiktok.com/@ev.ebi/video/..." }
  projects: []
};
