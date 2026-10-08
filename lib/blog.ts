/**
 * File-based blog posts for the public AAM site.
 * Add a new entry to POSTS (newest first) — no CMS required.
 */

export type BlogPost = {
  slug: string
  title: string
  excerpt: string
  /** ISO date YYYY-MM-DD */
  date: string
  author: string
  heroImage: string
  heroAlt: string
  /** Short tags for the index card */
  tags: string[]
  /** Article body as paragraphs (plain text; first is lead) */
  body: string[]
}

export const POSTS: BlogPost[] = [
  {
    slug: 'big-game-fishing-nosy-komba',
    title: 'Big-game fishing from Nosy Komba',
    excerpt:
      'Out past the reefs at first light, heavy tackle set and current lines waiting — how AAM runs a blue-water day for tuna, marlin, and dorado off Madagascar’s northwest coast.',
    date: '2026-10-07',
    author: 'AAM Fishing',
    heroImage: '/blog/odyssey-sunset.jpg',
    heroAlt:
      'Odyssey sportfishing boat at sunset off Nosy Komba with rods in holders',
    tags: ['Fishing', 'Nosy Komba', 'Big game'],
    body: [
      'Big-game fishing from Nosy Komba is not a half-hour hop to a buoy. It is an early departure, a run into blue water, and a day shaped by wind, current, and what the ocean is actually doing — not a brochure schedule.',
      'AAM Fishing bases itself on the island with AAM Charters and the rest of the coastal group. Guests step aboard a crewed sport vessel with premium tackle already set: two-speed reels, stout trolling rods, and a crew that knows when to push offshore and when to work the colour changes closer in.',
      'The northwest Madagascar grounds hold yellowfin tuna, mahi-mahi (dorado), wahoo, and marlin within reach of the coast when the season and conditions line up. We follow the fish, not a fixed list of waypoints. Some mornings the bite is on the current line; some days it is a longer search under a clean sky with the wake rolling behind the boat.',
      'A typical offshore day starts before the heat builds. Lines go out once we are clear of the inshore clutter. The crew watches the spreads, adjusts depth and speed, and keeps the deck ready for a strike — gaffs, gloves, and clear space at the stern. When a fish comes tight, everyone has a role: fighting chair or stand-up harness for the angler, leader work and boat handling for the crew.',
      'We fish for the fight first. Catch can be cleaned, filleted, and packed to take home, or released with care when that is the right call. Either way, the day is built around safety, good gear, and honest reading of the water.',
      'If you are planning a stay on Nosy Komba or nearby resorts and want a full-day pursuit rather than a casual inshore morning, ask for a big-game charter. We will match the boat, the tide window, and the season so you spend your hours where the fish are running.',
    ],
  },
]

export function getAllPosts(): BlogPost[] {
  return [...POSTS].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug)
}

export function formatPostDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
