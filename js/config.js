/* ====== EVebi, easy settings. Edit values here; no other file needed. ====== */
window.EVEBI = {
  // Site languages. Currently English only; use ["ka","en"] once the Georgian text is corrected.
  languages: ["en"],

  // Contact
  whatsapp: "995595606670",          // digits only, with country code
  email: "contact@evebi.ge",
  tiktok: "https://www.tiktok.com/@ev.ebi",
  instagram: "",                      // paste the official Instagram link; empty = hidden

  // Audience numbers (home page). A number left empty ("") is hidden automatically.
  // These are the figures recorded when 6 videos were published: confirm/update them.
  stats: {
    followers: "1,100+",
    videos: "6",
    views: { ka: "ასობით ათასი", en: "Hundreds of thousands" },
    asOf: { ka: "ციფრები დაფიქსირებულია 6 ვიდეოს გამოქვეყნებისას", en: "Figures recorded when EVebi had 6 published videos." }
  },

  // Forms. Create a free form at https://formspree.io (or any service that accepts
  // a JSON POST), paste its endpoint here, e.g. "https://formspree.io/f/abcdwxyz".
  // While empty, forms do NOT pretend to send: they offer WhatsApp / email instead.
  formEndpoint: "",

  // Media kit: put the PDF in assets/ and paste its path, e.g. "assets/evebi-media-kit.pdf".
  mediaKit: "",

  // ---- SELECTED WORK ---------------------------------------------------------
  // One entry per real project. category: "Vehicles" | "Technology" | "Ownership".
  // link  = the TikTok video URL (empty = card links to the TikTok profile)
  // image = thumbnail in assets/img/ (missing file = tidy placeholder)
  // text  = one factual line (leave "" until you have it; nothing is invented)
  projects: [
    { id: "model-3",  title: "Tesla Model 3",              category: "Vehicles",   text: "", link: "", image: "assets/img/work-model-3.jpg" },
    { id: "model-y",  title: "Tesla Model Y",              category: "Vehicles",   text: "", link: "", image: "assets/img/work-model-y.jpg" },
    { id: "eletre",   title: "Lotus Eletre 900",           category: "Vehicles",   text: "", link: "", image: "assets/img/work-eletre.jpg" },
    { id: "tesla-tech", title: "Tesla technology explained", category: "Technology", text: "", link: "", image: "assets/img/work-tesla-tech.jpg" },
    { id: "charging", title: "EV charging and ownership",  category: "Ownership",  text: "", link: "", image: "assets/img/work-charging.jpg" }
  ],

  // ---- DEALERSHIPS (publish only verified information) ------------------------
  // status: "dealer" (provided by the dealership) | "checked" (independently checked), anything not filled shows "Not confirmed".
  // Example (copy, fill, remove the comment):
  // { id:"example", name:"Dealership name", city:"Tbilisi", brands:["BYD"], condition:"New", updated:"2026-11-08",
  //   status:"dealer", models:["..."], vehicleWarranty:"", batteryWarranty:"", servicing:"", parts:"", testDrive:"",
  //   phone:"", website:"" }
  dealerships: []
};
