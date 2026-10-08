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
    slug: 'marlin-trophy-fish',
    title: 'Marlin: the trophy fish everyone really wants',
    excerpt:
      'Blue water, heavy gear, and one fish that still stops the deck cold — why marlin is the dream catch for big-game anglers running out of Nosy Komba with AAM.',
    date: '2026-10-08',
    author: 'AAM Fishing',
    heroImage: '/blog/marlin-biggame-sunset.png',
    heroAlt:
      'Gold big-game reels and trolling rods on the boat rail at sunset, ready for offshore marlin fishing off Nosy Komba',
    tags: ['Marlin', 'Big game', 'Nosy Komba'],
    body: [
      'Ask a serious angler what they came to Madagascar for, and plenty will say tuna or dorado without blinking. Ask what they really want — the fish that makes the whole trip feel earned — and the answer is almost always marlin.',
      'Out of Nosy Komba, marlin is not a guarantee and never a prop for photos. It is a blue-water pursuit: early steam offshore, spreads set in clean colour, and hours of reading current lines, bird activity, and temperature breaks while the crew keeps the gear honest. When the season and the water line up, that long billfish strike is the moment the day was built for.',
      'AAM Fishing and AAM Charters run the same coastal group from the island. Guests step onto a crewed sport boat with stout trolling rods, two-speed reels, and leaders ready for a fish that can empty a spool in seconds. The deck stays clear. Someone watches the outriggers. Someone is already thinking about the chair, the harness, and how the boat will turn when the line comes tight.',
      'Northwest Madagascar’s offshore grounds hold striped and other billfish within reach when conditions favour a longer run. Some days the bite shows itself early; some days you search under a hard sun with nothing but wake and patience. That is part of the pull. Marlin fishing rewards people who treat the ocean as it is — not as a checklist of named waypoints.',
      'When a marlin does come up, the fight is physical and loud. The angler works the rod; the crew manages the leader, the boat angle, and the release or boatside work. We fish for the fight first. Where tags, careful release, or a fish for the table make sense under local rules and the skipper’s call, we do it cleanly and without theatre.',
      'If you are planning Nosy Komba or a nearby resort stay and the fish in your head is the one with the bill and the jump, ask for a dedicated big-game day aimed at marlin. We will match boat, tide window, and season so your hours go where trophy fish actually run — not where a brochure says they should.',
    ],
  },
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
