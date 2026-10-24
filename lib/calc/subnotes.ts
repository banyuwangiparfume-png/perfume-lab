/**
 * Sub-aroma tiap facet: "Woody-nya kayu apa?"
 *
 * Facet menjawab arah besar (woody, floral). Sub-aroma menjawab yang
 * sebenarnya dicium perfumer — sandalwood dan cedarwood sama-sama woody tapi
 * dua parfum yang berbeda. Kamus di sini PENGETAHUAN, bukan hitungan: kata
 * kunci yang biasa muncul di nama produk dan di odour profile supplier.
 *
 * Penggolongan sebuah bahan: kata kunci yang muncul PALING AWAL di teks
 * "nama | sinonim | odour profile" menang. Nama didahulukan karena nama
 * produk paling jujur soal identitasnya ("Methyl Cedryl Ketone / Vertofix"),
 * lalu odour profile — supplier menyebut deskriptor dominan lebih dulu.
 * Yang tidak cocok satu pun masuk kelompok "lain", tidak ditebak.
 *
 * Kata kunci dicocokkan sebagai KATA UTUH — "agar" tidak boleh menangkap
 * "cigar" (tembakau jadi oud), "rose" tidak boleh menangkap "rosemary",
 * "lime" tidak boleh menangkap "sublime". Akhiran "~" menandai awalan yang
 * memang disengaja: "cedr~" untuk cedryl, cedrol, cedrene.
 */

export type Subnote = { key: string; label: string; keywords: string[] };

export const SUBNOTES: Record<string, Subnote[]> = {
  woody: [
    {
      key: "sandalwood",
      label: "Sandalwood",
      keywords: ["sandalwood", "sandal", "santal~", "sandalore", "bacdanol", "ebanol", "javanol", "polysantol", "santaliff", "firsantol", "sandranol", "mysore", "sandela"],
    },
    {
      key: "cedarwood",
      label: "Cedarwood",
      keywords: ["cedarwood", "cedar", "cedr~", "vertofix", "cedramber", "atlas", "virginia", "pencil"],
    },
    {
      key: "ambery-woods",
      label: "Ambery woods",
      keywords: ["iso e", "amberwood", "karanal", "timbersilk", "norlimbanol", "georgywood", "ambertonic", "ambery wood", "amber wood", "dry wood"],
    },
    { key: "oud", label: "Oud", keywords: ["oud", "agarwood", "aoud", "oudh", "agar"] },
    { key: "vetiver", label: "Vetiver", keywords: ["vetiver", "vetyver", "khus"] },
    { key: "patchouli", label: "Patchouli", keywords: ["patchouli", "patchouly", "patchoul~"] },
    { key: "guaiac", label: "Guaiac", keywords: ["guaiac", "guaiacwood", "guaiyl"] },
    { key: "cypriol", label: "Cypriol", keywords: ["cypriol", "nagarmotha", "papyrus"] },
    { key: "cashmere", label: "Cashmere wood", keywords: ["cashmeran", "cashmere"] },
    { key: "rosewood", label: "Rosewood", keywords: ["bois de rose", "rosewood", "ho wood"] },
    { key: "smoky", label: "Smoky woods", keywords: ["smoky", "smoke", "birch", "tar", "cade", "leather", "leathery", "tobacco", "guaiacol"] },
    { key: "pine", label: "Pine / Conifer", keywords: ["pine", "pinene", "fir", "cypress", "juniper", "conifer", "spruce", "cedar leaf"] },
    { key: "mossy", label: "Mossy", keywords: ["moss", "mossy", "oakmoss", "veramoss", "evernyl"] },
    { key: "resinous", label: "Resin / Balsamic", keywords: ["balsam", "balsamic", "resin", "resinous", "resinoid", "myrrh", "benzoin", "olibanum", "frankincense", "labdanum"] },
  ],
  floral: [
    { key: "rose", label: "Rose", keywords: ["rose", "rosy", "peony", "geranium", "phenyl ethyl", "phenylethyl", "citronellol", "geraniol", "damascone", "rhodinol", "nerol"] },
    { key: "jasmine", label: "Jasmine", keywords: ["jasmine", "jasmin", "hedione", "dihydrojasmon~", "jasmone", "benzyl acetate", "indol~", "sambac"] },
    { key: "white", label: "White floral", keywords: ["tuberose", "gardenia", "frangipani", "plumeria", "kamboja", "ylang", "benzyl salicylate", "magnolia", "camellia", "tsubaki"] },
    { key: "orange-blossom", label: "Orange blossom", keywords: ["orange blossom", "orange flower", "neroli", "methyl anthranilate", "aurantiol"] },
    { key: "muguet", label: "Muguet / Lily", keywords: ["muguet", "lily", "hydroxycitronellal", "lilial", "lyral", "florol", "mayol", "cyclamen", "lilac", "wisteria"] },
    { key: "violet-iris", label: "Violet / Iris", keywords: ["violet", "ionone", "iris", "orris", "irone"] },
    { key: "aldehydic", label: "Aldehydic floral", keywords: ["aldehyde~", "aldehydic"] },
    { key: "watery", label: "Watery floral", keywords: ["watery", "aquatic", "ozone", "ozonic", "hydrangea", "ajisai", "lotus", "water lily"] },
    { key: "blossom", label: "Blossom", keywords: ["sakura", "cherry blossom", "blossom", "plum blossom"] },
  ],
  citrus: [
    { key: "bergamot", label: "Bergamot", keywords: ["bergamot"] },
    { key: "lemon", label: "Lemon", keywords: ["lemon", "citral", "lemongrass", "litsea"] },
    { key: "lime", label: "Lime", keywords: ["lime"] },
    { key: "orange", label: "Orange / Mandarin", keywords: ["orange", "mandarin", "tangerine", "clementine"] },
    { key: "grapefruit", label: "Grapefruit", keywords: ["grapefruit", "pamplemousse", "nootkatone"] },
    { key: "yuzu", label: "Yuzu", keywords: ["yuzu"] },
    { key: "petitgrain", label: "Petitgrain", keywords: ["petitgrain", "neroli"] },
    { key: "fresh", label: "Citrus segar", keywords: ["dihydromyrcenol", "citronitrile", "aldehyde~", "aldehydic", "octanal", "decanal", "linalool"] },
  ],
  musk: [
    { key: "macrocyclic", label: "Musk makrosiklik", keywords: ["habanolide", "exaltolide", "pentadecanolide", "ethylene brassylate", "musk t", "ambrettolide", "muscone", "velvione", "globalide", "helvetolide", "romandolide"] },
    { key: "polycyclic", label: "Musk polisiklik", keywords: ["galaxolide", "tonalide", "celestolide"] },
    { key: "white", label: "White / clean musk", keywords: ["white musk", "clean musk", "cotton", "powdery musk"] },
    { key: "animalic", label: "Musk animalik", keywords: ["civet", "castoreum", "musk ketone", "animalic"] },
  ],
  amber: [
    { key: "ambergris", label: "Ambergris", keywords: ["ambrox~", "cetalox", "ambrocenide", "ambergris", "ambrinol", "grisalva"] },
    { key: "ambery-woods", label: "Ambery woods", keywords: ["iso e", "amberwood", "karanal", "timbersilk", "norlimbanol", "ambertonic"] },
    { key: "resinous", label: "Amber resin", keywords: ["labdanum", "cistus", "benzoin", "styrax", "tolu", "peru", "olibanum", "frankincense", "opoponax", "myrrh"] },
  ],
  fruity: [
    { key: "berry", label: "Berry", keywords: ["berry", "raspberry", "strawberry", "cassis", "blackcurrant", "blueberry", "frambinone", "raspberry ketone"] },
    { key: "apple-pear", label: "Apple / Pear", keywords: ["apple", "pear", "verdox", "manzanate"] },
    { key: "stone", label: "Peach / Apricot", keywords: ["peach", "apricot", "plum", "aldehyde c-14", "aldehyde c-18", "lactone", "nectarine"] },
    { key: "tropical", label: "Tropical", keywords: ["pineapple", "mango", "coconut", "passion", "banana", "tropical", "allyl", "cetone v"] },
  ],
  gourmand: [
    { key: "vanilla", label: "Vanilla", keywords: ["vanill~", "ethyl vanillin", "heliotropin"] },
    { key: "tonka", label: "Tonka / Coumarin", keywords: ["tonka", "coumarin"] },
    { key: "caramel", label: "Caramel / Sugar", keywords: ["caramel", "maltol", "ethyl maltol", "furaneol", "sugar", "cotton candy", "praline"] },
    { key: "honey", label: "Honey", keywords: ["honey", "phenylacetic", "beeswax"] },
    { key: "coffee-choc", label: "Coffee / Cocoa", keywords: ["coffee", "cocoa", "chocolate", "nutty", "hazelnut"] },
  ],
  spicy: [
    { key: "warm", label: "Rempah hangat", keywords: ["cinnamon", "clove", "eugenol", "nutmeg", "cardamom", "allspice", "pimento"] },
    { key: "fresh", label: "Rempah segar", keywords: ["pepper", "pink pepper", "ginger", "coriander", "black pepper"] },
    { key: "saffron", label: "Saffron", keywords: ["saffron", "safranal", "cumin"] },
  ],
};

/** Kunci kelompok untuk bahan yang tidak cocok dengan satu pun sub-aroma. */
export const OTHER_SUBNOTE = "__lain";

export const hasSubnotes = (facet: string) => (SUBNOTES[facet]?.length ?? 0) > 0;

const escape = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patternCache = new Map<string, RegExp>();

/** Kata utuh, atau awalan kalau diakhiri "~". */
function keywordPattern(kw: string): RegExp {
  let re = patternCache.get(kw);
  if (!re) {
    const prefix = kw.endsWith("~");
    const body = escape(prefix ? kw.slice(0, -1) : kw);
    re = new RegExp(`(?:^|[^a-z])(${body})${prefix ? "" : "(?![a-z])"}`);
    patternCache.set(kw, re);
  }
  return re;
}

/**
 * Sub-aroma sebuah bahan di dalam satu facet. Teks yang diberikan sebaiknya
 * "nama | sinonim | odour profile" — urutan itu yang menentukan prioritas.
 */
export function classifySubnote(facet: string, text: string): string {
  const list = SUBNOTES[facet];
  if (!list) return OTHER_SUBNOTE;
  const t = text.toLowerCase();
  let best: { key: string; pos: number } | null = null;
  for (const sub of list) {
    for (const kw of sub.keywords) {
      const m = keywordPattern(kw).exec(t);
      if (!m) continue;
      const pos = m.index + m[0].length - m[1].length;
      if (!best || pos < best.pos) best = { key: sub.key, pos };
    }
  }
  return best?.key ?? OTHER_SUBNOTE;
}

export function subnoteLabel(facet: string, key: string, facetLabel: string): string {
  if (key === OTHER_SUBNOTE) return `${facetLabel} lain`;
  return SUBNOTES[facet]?.find((s) => s.key === key)?.label ?? key;
}
