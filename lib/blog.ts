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
   * - plain strings → paragraphs (inline **bold** / *italic* supported)
   * - "## Heading" / "### Heading" → section titles
   * - "![alt](/path.jpg)" → section figure
   * - "- item" (consecutive) → bullet list
   * - "*emphasis*" → italic closing line
   */
  body: string[]
}

export const POSTS: BlogPost[] = [
  {
    slug: 'big-game-fishing-nosy-be',
    title:
      'Big Game Fishing on Nosy Be — what the waters of northwest Madagascar hold',
    excerpt:
      'From mighty marlin and sailfish to yellowfin tuna and giant trevally — discover the exceptional world of sport fishing in the Indian Ocean around Nosy Be.',
    date: '2026-10-14',
    author: 'AAM Fishing',
    heroImage: '/blog/nosy-be-big-game-hero.png',
    heroAlt:
      'Sportfishing boat wake cutting through deep blue Indian Ocean water off northwest Madagascar',
    tags: ['Big game', 'Nosy Be', 'Madagascar'],
    body: [
      'From mighty marlin and sailfish to yellowfin tuna and giant trevally — discover the exceptional world of sport fishing in the Indian Ocean.',
      '## Nosy Be — where a true fishing adventure begins',
      '![Early light over tropical islands and calm water near Nosy Be, Madagascar](/blog/nosy-be-dawn.jpg)',
      'Picture an early morning on the Indian Ocean. The sun rises slowly over the islands of Madagascar, the sea is calm, and beneath the boat a completely different world waits in the depths. Suddenly the rod bends, the reel starts screaming line, and the fight begins.',
      'Welcome to Nosy Be — one of the most compelling areas for Big Game Fishing in the Indian Ocean.',
      'The northwest coast of Madagascar offers an exceptional mix of deep water, underwater plateaus, coral reefs, strong ocean currents, and rich feeding grounds. That diversity creates outstanding conditions for many species of large predatory fish.',
      'What makes Nosy Be special is that on a single fishing trip you can combine the pursuit of big oceanic fish with more technical reef fishing.',
      '## Which big fish can we catch around Nosy Be?',
      '### Marlin — king of the deep ocean',
      '![Gold big-game reels and trolling rods on the boat rail at sunset, ready for offshore marlin](/blog/marlin-biggame-sunset.png)',
      'For many sport anglers, marlin is the ultimate challenge. In the waters of northwest Madagascar you mainly encounter black marlin (*Black Marlin*) and blue marlin (*Blue Marlin*).',
      'These are exceptionally strong, fast, and enduring fish that can weigh several hundred kilograms. Marlin is known for long runs, sudden changes of direction, and spectacular leaps above the surface.',
      'The most common method is trolling, in which the boat tows artificial or natural baits through areas where large pelagic fish hold.',
      'A meeting with a marlin is never a daily guarantee. It is precisely that unpredictability — and the extraordinary power of the fish — that creates the experience that brings anglers back to Madagascar.',
      '### Sailfish — the fastest spectacle on the surface',
      '![Sailfish with its tall dorsal fin raised in blue tropical water](/blog/sailfish.png)',
      'The sailfish is one of the most recognisable oceanic fish. Its large dorsal fin recalls a sail, and during the fight it can show incredible speed and agility.',
      'Sailfish often attack schools of smaller baitfish, so their presence can also be read from activity on the surface.',
      'For sport anglers they are an especially exciting target because of violent takes and frequent jumps clear of the water.',
      '### Yellowfin tuna — the yellow-finned powerhouse',
      '![Yellowfin tuna with silver-gold flanks swimming just beneath the surface](/blog/yellowfin-tuna.png)',
      'Yellowfin tuna (*Thunnus albacares*) is one of the most prized fish of the open ocean.',
      'It is marked by yellow fins, an aerodynamic body, and remarkable muscular power. When it takes the bait, a long and physically demanding fight can follow.',
      'Tuna can be caught by trolling, jigging, and casting artificial lures near schools feeding on the surface.',
      'Their presence is often tied to ocean currents, temperature breaks, and concentrations of smaller baitfish.',
      '### Dogtooth tuna — power from the depths',
      '![Open blue water and fishing wake over deep structure off northwest Madagascar](/blog/nosy-be-big-game-hero.png)',
      'Dogtooth tuna (*Gymnosarda unicolor*) is one of the most demanding fish for jigging enthusiasts.',
      'Although it is called a tuna, it belongs to a different group from yellowfin. It is an exceptionally aggressive predator that often holds along deep reefs, underwater walls, and steep drop-offs.',
      'After the take it often charges hard toward rocks and coral, so quick action from the angler is decisive.',
      '### Giant Trevally — GT, the legend of tropical fishing',
      '![Big-game rods racked on the stern at sunset during an offshore day](/blog/biggame-rods-sunset.png)',
      'Giant trevally (*Giant Trevally*, or GT) is one of the most popular fish among popping enthusiasts.',
      'GT is known for an extraordinarily powerful attack on a surface lure. Sometimes it feels as if the water has literally exploded.',
      'Anglers look for them mainly along coral reefs, rocky shorelines, and underwater structure where they ambush prey.',
      'Fishing for GT demands quality tackle, strong rods, and solid physical fitness.',
      '### Wahoo — the lightning predator',
      'Wahoo is a slender, extremely fast predatory fish that appears in open water and along the edges of underwater plateaus.',
      'Its strikes are often sudden and very violent. Because of its speed it is a favourite target when trolling.',
      '### Mahi-mahi — the colourful hunter of the open ocean',
      '![Green and gold mahi-mahi leaping clear of deep blue water](/blog/mahi-mahi.png)',
      'Mahi-mahi, also known as dorado or dolphin fish, is one of the most colourful tropical fish.',
      'Its body shimmers in greens, blues, and golds. It is often found near floating objects, current lines, and areas rich in smaller baitfish.',
      'Beyond its striking appearance it is known for acrobatic jumps and a lively fight.',
      '### Barracuda, king mackerel, and other species',
      '![Colourful trolling skirts and offshore lures ready for a spread](/blog/trolling-lures.png)',
      'The waters around Nosy Be offer far more than only the best-known big-game species.',
      'Among frequent targets for sport anglers are also barracuda, king mackerel, various trevally, amberjack, groupers, and tropical snappers.',
      'It is precisely because of that diversity that every fishing day can be different.',
      '## The most interesting fishing grounds',
      '### Nosy Be and the surrounding reefs',
      '![Coral reefs and turquoise water around the Nosy Be island group](/blog/nosy-be-reefs.png)',
      'Nosy Be is an excellent base for shorter trips and full-day fishing expeditions.',
      'The area combines coastal reefs, underwater structure, and access to deeper water in the Mozambique Channel.',
      'Fishing can be adapted for beginners and experienced anglers alike, depending on weather conditions and the technique you want to fish.',
      '### The Mitsio Archipelago — the wild north',
      '![Volcanic islands and wild coastline of the Mitsio Archipelago north of Nosy Be](/blog/mitsio-archipelago.png)',
      'North of Nosy Be lies the Mitsio island group, known for volcanic islands, steep underwater walls, and rich marine life.',
      'This is an especially interesting area for popping and jigging — above all for GT, dogtooth tuna, wahoo, and other large predators.',
      'Distance from major tourist centres gives fishing around Mitsio the feel of a true expedition.',
      '### Leven Bank and Grand Castor Bank',
      '![Wide open ocean horizon over offshore banks and deep blue water](/blog/open-ocean-banks.jpg)',
      'Offshore underwater plateaus rank among the most interesting grounds for more demanding sport fishing.',
      'Leven Bank and Grand Castor Bank combine shallower underwater structure, deep edges, and strong currents.',
      'That environment attracts many predatory fish, including large trevally, tuna, wahoo, and marlin.',
      'Visiting these grounds requires a suitable vessel, an experienced crew, and careful planning around the weather.',
      '### Radama — fishing in more remote waters',
      '![Remote coastal bay and island shoreline south of Nosy Be](/blog/radama-coast.png)',
      'South of Nosy Be stretches the Radama archipelago, offering varied fishing grounds along reefs, underwater plateaus, and deeper water.',
      'Because of its remoteness it is especially interesting for longer fishing expeditions and anglers who want to explore less-visited parts of Madagascar.',
      '## Which fishing techniques are most popular?',
      '![Sportfishing boat Odyssey ready for an offshore run](/blog/odyssey-boat.png)',
      '**Trolling** is the classic technique for marlin, sailfish, tuna, wahoo, and mahi-mahi. While underway, the boat tows baits at different distances and depths.',
      '**Popping** is a dynamic surface technique with large artificial lures. It is especially popular for GT.',
      '**Jigging** lets you fish deeper water by working heavier artificial lures vertically. It is often used for dogtooth tuna, amberjack, and other predators along the reefs.',
      '**Bottom fishing** targets species that hold closer to the seabed, including groupers and snappers.',
      'The choice of technique depends on location, weather, ocean currents, and how active the fish are.',
      '## When is the best time for Big Game Fishing on Nosy Be?',
      '![Charter boat at golden hour off the Madagascar coast](/blog/charter-golden-hour.png)',
      'Sport fishing around Nosy Be is possible at various times of year, but conditions and the presence of individual species shift.',
      'The period from April to November often offers more favourable conditions for running and offshore fishing.',
      'Sailfish is especially interesting roughly from May to November, while yellowfin tuna can appear in greater numbers in the first half of the year. Marlin, GT, and other species each have their own seasonal windows, depending on the specific fishing ground.',
      'From January to March, tropical storms, stronger winds, and cyclone conditions can limit days at sea.',
      'It is important to understand that fishing cannot be planned by the calendar alone. Weather, currents, tides, and the movement of fish are decisive too.',
      '## Responsible sport fishing — respect for the ocean',
      '![Crew aboard Odyssey working together on the water](/blog/crew-odyssey.png)',
      'Large oceanic fish are an important part of the marine ecosystem.',
      'In sport fishing, the practice of *catch and release* — catch and release — is therefore increasingly important, especially for species such as marlin and sailfish.',
      'Handling the fish correctly, keeping time out of the water as short as possible, and using appropriate gear all improve its chances of survival after release.',
      'Responsible fishing also means respecting protected areas, local regulations, and marine life.',
      '## Why choose Nosy Be for your next fishing adventure?',
      'Few destinations offer so many different fishing opportunities in a relatively small geographic area.',
      'On Nosy Be you can spend one day seeking marlin on the open ocean, the next fishing GT along coral reefs, then set out on a multi-day expedition toward the remote Mitsio islands.',
      'But Big Game Fishing is not only about the catch.',
      'It is the anticipation in every movement of the rod. It is the sound of the reel as a big fish takes line into the depths. It is the teamwork between angler and crew — and respect for an ocean that never reveals all of its secrets.',
      '**The waters around Nosy Be offer something that cannot be bought or guaranteed — the chance of a truly unforgettable encounter with the wild Indian Ocean.**',
      '*Ready for your next fishing adventure in Madagascar? Discover Big Game Fishing on Nosy Be and experience the ocean from an entirely different perspective.*',
    ],
  },
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
