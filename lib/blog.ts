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
  /**
   * Article body (first entry is the lead). Conventions on the post page:
   * - plain strings → paragraphs
   * - "## Heading" → section titles
   * - "- item" (consecutive) → bullet list
   * - "*emphasis*" → italic closing line
   */
  body: string[]
}

export const POSTS: BlogPost[] = [
  {
    slug: 'marlin-trophy-fish',
    title:
      'Marlin fishing in Madagascar — an unforgettable Indian Ocean adventure',
    excerpt:
      'Madagascar is more than beaches and rainforest — around Nosy Be and the Mitsio islands, blue water holds one of sport fishing’s most coveted prizes: the magnificent marlin.',
    date: '2026-10-13',
    author: 'AAM Fishing',
    heroImage: '/blog/marlin-biggame-sunset.png',
    heroAlt:
      'Gold big-game reels and trolling rods on the boat rail at sunset, ready for offshore marlin fishing off Nosy Komba',
    tags: ['Marlin', 'Madagascar', 'Nosy Be'],
    body: [
      'Madagascar is not only an island of beautiful beaches, tropical forests, and unique wildlife. It is also one of the most compelling destinations for sport-fishing enthusiasts. In the deep waters of the Indian Ocean — especially around the Nosy Be and Mitsio archipelagos — lies one of the most sought-after catches for any passionate angler: the magnificent marlin.',
      '## Marlin — king of the open sea',
      'The marlin ranks among the fastest, strongest, and most admired fish in sport fishing. Its elegant, hydrodynamic body, long pointed bill, and extraordinary power place it among the toughest opponents on the open ocean.',
      'In Madagascar’s waters you can encounter mainly blue and black marlin, along with other large pelagic species.',
      'The blue marlin (Makaira nigricans) can grow into an exceptionally large fish weighing several hundred kilograms. When it takes the bait, a real test of strength, patience, and angling skill begins.',
      'Its spectacular leaps from the water, sudden runs, and powerful pulls create moments anglers remember for a lifetime.',
      '## Why is Madagascar so attractive for marlin fishing?',
      'The northwest of Madagascar offers outstanding conditions for offshore sport fishing. Warm tropical seas, underwater reefs, deep channels, and rich marine life draw many species of large predatory fish.',
      'Especially interesting areas include:',
      '- Nosy Be: a popular starting point for offshore fishing expeditions.',
      '- Nosy Komba: a beautiful tropical island from which fishing trips into the surrounding waters can be organised.',
      '- The Mitsio archipelago: a more remote area with numerous reefs, underwater structure, and deeper water.',
      '- The open sea northwest of Madagascar: ground for seeking large pelagic fish, including marlin.',
      'Fishing in these areas is not only a hunt for a big fish. It is an experience of unspoiled nature, the endless ocean, and a sense of freedom that only the open sea can offer.',
      '## How does marlin fishing work?',
      'The most common technique for marlin is trolling, in which the boat tows artificial lures or specially prepared natural baits at a set speed.',
      'Professional fishing gear includes stout rods, large saltwater reels, quality line, and specialised lures that imitate the movement of baitfish on the ocean surface.',
      'The captain watches ocean currents, water temperature, the presence of bait schools, and the movement of seabirds. All of that can signal that large predators are nearby.',
      'When a marlin takes the bait, calm observation of the ocean turns in an instant into an adrenaline-charged fight.',
      'The fish can strip line from the reel at great speed, change direction, and launch itself high above the surface again and again. The fight may last from a few minutes to several hours, depending on the size of the fish, the gear, and conditions at sea.',
      'It is precisely that unpredictability that makes marlin fishing so special.',
      '## When is the best time for marlin fishing in Madagascar?',
      'In the northwest waters of Madagascar, sport fishing is possible at various times of year, but marlin presence shifts with the season, ocean currents, and the availability of prey.',
      'The period roughly from October to April can be interesting for large pelagic fish — though part of that window overlaps with the rainy and cyclone season.',
      'The best timing therefore depends not only on where the fish are, but also on wind, swell, and safe running conditions.',
      'An experienced local captain can advise, based on current conditions, when and where to go.',
      '## Catch & Release — respect for the ocean',
      'The marlin is an extraordinary animal with an important role in the marine ecosystem.',
      'That is why Catch & Release — catch and release — is increasingly the standard in sport fishing.',
      'The goal is to experience the encounter with this magnificent fish, document it when possible, and then release it back into the sea as safely as you can.',
      'That means using appropriate gear, keeping the fight as short as possible, and, whenever you can, releasing the fish beside the boat without lifting it from the water.',
      'This approach helps ensure that future generations of anglers can still admire these exceptional ocean dwellers.',
      '## More than just fishing',
      'A fishing expedition in Madagascar is a special experience even for those who care about more than the catch alone.',
      'Picture an early morning as the boat leaves a tropical island. The sun rises slowly over the Indian Ocean, the horizon turns gold, and endless blue stretches around the boat.',
      'Along the way you may see dolphins, seabirds, and occasionally other interesting ocean wildlife.',
      'Every day at sea is different. Sometimes the reward is a spectacular catch; sometimes it is an unforgettable meeting with nature.',
      'That is the real charm of a genuine fishing adventure.',
      '## Experience marlin fishing in Madagascar',
      'Whether you are an experienced sport angler or want to feel offshore fishing for the first time, northwest Madagascar is a destination with exceptional possibilities.',
      'Marlin fishing combines adventure, skill, patience, and respect for nature.',
      'Perhaps on your next expedition into the Indian Ocean you will live the moment when a mighty marlin rises from the depths and an unforgettable fight begins — between angler and one of the most magnificent fish in the world.',
      '*The ocean does not promise a catch. It does promise an adventure you will not forget.*',
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
