export type ProductCategory =
  | 'Rods & Reels'
  | 'Lines & Leaders'
  | 'Lures & Baits'
  | 'Terminal Tackle'
  | 'Apparel'
  | 'Accessories'

export type Product = {
  id: string
  name: string
  category: ProductCategory
  /** Price in EUR */
  price: number
  image: string
  alt: string
  description: string
  /** Optional: mark a few products as featured on the shop landing */
  featured?: boolean
}

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  'Rods & Reels',
  'Lines & Leaders',
  'Lures & Baits',
  'Terminal Tackle',
  'Apparel',
  'Accessories',
]

/** A product row coming from the database (admin-managed). */
type DbProductRow = {
  id: number
  name: string
  category: string
  price: number
  image: string | null
  alt: string
  description: string
  featured: boolean
}

/** Map a DB row into the shape the storefront + cart use (string id `db-<id>`). */
export function toProduct(row: DbProductRow): Product {
  return {
    id: `db-${row.id}`,
    name: row.name,
    category: (PRODUCT_CATEGORIES.includes(row.category as ProductCategory)
      ? row.category
      : 'Accessories') as ProductCategory,
    price: row.price,
    image: row.image || '/placeholder.svg?height=800&width=800',
    alt: row.alt || row.name,
    description: row.description,
    featured: row.featured,
  }
}

function placeholder(query: string) {
  return `/placeholder.svg?height=800&width=800&query=${encodeURIComponent(query)}`
}

export const PRODUCTS: Product[] = [
  {
    id: 'rod-offshore-30',
    name: 'Offshore Trolling Rod 30lb',
    category: 'Rods & Reels',
    price: 189,
    image: placeholder('offshore trolling fishing rod on white background, product photo'),
    alt: 'Offshore trolling rod',
    description:
      'Heavy-duty 30lb-class trolling rod built for big-game runs — roller guides and a reinforced butt for tuna and marlin.',
    featured: true,
  },
  {
    id: 'reel-conventional-50',
    name: 'Conventional Reel 50W',
    category: 'Rods & Reels',
    price: 349,
    image: placeholder('gold conventional big game fishing reel on white background, product photo'),
    alt: 'Conventional big-game reel',
    description:
      'Two-speed lever-drag reel with a sealed carbon drag and 50W line capacity for serious offshore fights.',
    featured: true,
  },
  {
    id: 'reel-spinning-8000',
    name: 'Spinning Reel 8000',
    category: 'Rods & Reels',
    price: 219,
    image: placeholder('saltwater spinning fishing reel on white background, product photo'),
    alt: 'Saltwater spinning reel',
    description:
      'Sealed saltwater spinning reel with a smooth 12kg drag — ideal for popping and jigging reef edges.',
  },
  {
    id: 'line-braid-80',
    name: 'Braided Line 80lb · 300m',
    category: 'Lines & Leaders',
    price: 39,
    image: placeholder('spool of braided fishing line on white background, product photo'),
    alt: 'Braided fishing line spool',
    description:
      '8-carrier braided line with low stretch and a tight weave for maximum casting distance and strike detection.',
  },
  {
    id: 'leader-fluoro-100',
    name: 'Fluorocarbon Leader 100lb',
    category: 'Lines & Leaders',
    price: 24,
    image: placeholder('coil of fluorocarbon fishing leader on white background, product photo'),
    alt: 'Fluorocarbon leader coil',
    description:
      'Abrasion-resistant fluorocarbon leader that stays near-invisible in clear blue water.',
  },
  {
    id: 'lure-trolling-skirt',
    name: 'Trolling Skirt Lure',
    category: 'Lures & Baits',
    price: 29,
    image: placeholder('colorful trolling skirt fishing lure on white background, product photo'),
    alt: 'Trolling skirt lure',
    description:
      'Weighted-head skirted trolling lure with a lively swimming action — a proven mahi-mahi and wahoo raiser.',
    featured: true,
  },
  {
    id: 'lure-biteme-bigame',
    name: 'Bite Me Big Game Trolling Lure',
    category: 'Lures & Baits',
    price: 34,
    image: '/images/products/biteme-trolling-lures.png',
    alt: 'Bite Me big game trolling lure with a blue jet head and iridescent skirt',
    description:
      'Bite Me big-game trolling lure with a weighted blue jet head and a full iridescent skirt. Swims with a tight, bubbling wobble that raises marlin, tuna, and mahi-mahi. Assorted colours — let us know your preference at checkout.',
    featured: true,
  },
  {
    id: 'lure-biteme-squid',
    name: 'Bite Me Squid Skirt Lure',
    category: 'Lures & Baits',
    price: 32,
    image: '/images/products/biteme-squid-lures.png',
    alt: 'Bite Me squid skirt trolling lures with mottled heads and pink, red, and purple skirts',
    description:
      'Bite Me squid-style trolling lure with a mottled head and a soft pink, red, and purple skirt. A lively surface-runner that pulls tuna, mahi-mahi, and wahoo. Assorted colours; tell us your preference at checkout.',
  },
  {
    id: 'lure-rigged-set',
    name: 'Pre-Rigged Big Game Lure',
    category: 'Lures & Baits',
    price: 45,
    image: '/images/products/rigged-trolling-lures.png',
    alt: 'Pre-rigged big game trolling lure with a glitter skirt, heavy hook, and leader',
    description:
      'Fully pre-rigged trolling lure — resin head, sparkling skirt, heavy-duty hook, and crimped leader ready to run straight from the pack. Built for marlin and tuna. Assorted colours; tell us your preference at checkout.',
  },
  {
    id: 'lure-executioner-marlin-candy',
    name: 'Executioner Lures — Marlin Candy',
    category: 'Lures & Baits',
    price: 39,
    image: '/images/products/executioner-marlin-candy.png',
    alt: 'Executioner Lures Marlin Candy trolling lure with a clear holographic head and dark purple iridescent skirt',
    description:
      'Executioner Lures in the "Marlin Candy" colour — a clear holographic head paired with a dark purple and black glitter skirt. A deep-water marlin favourite that flashes hard in blue water. Assorted colours; tell us your preference at checkout.',
    featured: true,
  },
  {
    id: 'lure-pulsator-stiff-rig',
    name: 'Pulsator Handmade Stiff-Rig Lure',
    category: 'Lures & Baits',
    price: 42,
    image: '/images/products/pulsator-stiff-rig-lures.png',
    alt: 'Pulsator handmade stiff-rig trolling lures in black glitter and blue-purple, in branded packaging',
    description:
      'Pulsator quality handmade lure on a pre-tied stiff-rig — a firm, straight-tracking swim that stands up to hard-charging billfish and tuna. Available in black glitter and blue-purple; tell us your preference at checkout.',
  },
  {
    id: 'lure-popper',
    name: 'Surface Popper 150mm',
    category: 'Lures & Baits',
    price: 18,
    image: placeholder('surface popper fishing lure on white background, product photo'),
    alt: 'Surface popper lure',
    description:
      'Loud, splashy topwater popper that draws explosive strikes from GTs and reef predators.',
  },
  {
    id: 'lure-jig-200',
    name: 'Speed Jig 200g',
    category: 'Lures & Baits',
    price: 15,
    image: placeholder('metal speed jig fishing lure on white background, product photo'),
    alt: 'Speed jig lure',
    description:
      'Center-balanced speed jig with a holographic finish for fast, fluttering drops over deep structure.',
  },
  {
    id: 'hooks-circle',
    name: 'Circle Hooks (pack of 25)',
    category: 'Terminal Tackle',
    price: 12,
    image: placeholder('circle fishing hooks pack on white background, product photo'),
    alt: 'Circle hooks pack',
    description:
      'Corrosion-resistant circle hooks for clean, safe releases — sizes 6/0 to 10/0.',
  },
  {
    id: 'swivels-ballbearing',
    name: 'Ball-Bearing Swivels (pack of 10)',
    category: 'Terminal Tackle',
    price: 14,
    image: placeholder('ball bearing fishing swivels pack on white background, product photo'),
    alt: 'Ball-bearing swivels',
    description:
      'High-strength ball-bearing swivels with welded rings that spin freely under heavy trolling loads.',
  },
  {
    id: 'apparel-tee',
    name: 'AAM Performance Tee',
    category: 'Apparel',
    price: 32,
    image: placeholder('blue performance fishing t-shirt on white background, product photo'),
    alt: 'AAM performance fishing tee',
    description:
      'Quick-dry UPF 50+ shirt in AAM blue — light, breathable, and built for long days in the sun.',
    featured: true,
  },
  {
    id: 'apparel-cap',
    name: 'AAM Flat-Brim Cap',
    category: 'Apparel',
    price: 26,
    image: placeholder('blue fishing flat brim cap on white background, product photo'),
    alt: 'AAM flat-brim cap',
    description:
      'Structured flat-brim cap with an embroidered AAM mark and a moisture-wicking sweatband.',
  },
  {
    id: 'acc-pliers',
    name: 'Aluminium Fishing Pliers',
    category: 'Accessories',
    price: 34,
    image: placeholder('aluminium fishing pliers on white background, product photo'),
    alt: 'Aluminium fishing pliers',
    description:
      'Anodized aluminium pliers with a braid cutter and split-ring tip, plus a sheath and lanyard.',
  },
  {
    id: 'acc-drybag',
    name: 'Waterproof Dry Bag 20L',
    category: 'Accessories',
    price: 42,
    image: placeholder('waterproof dry bag on white background, product photo'),
    alt: 'Waterproof dry bag',
    description:
      'Roll-top 20L dry bag that keeps phones, cameras, and layers safe from spray and rain.',
  },
]

export function formatEur(amount: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount)
}
