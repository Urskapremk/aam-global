import {
  Fish,
  Sailboat,
  Ship,
  ShoppingBag,
  Compass,
  Waves,
  type LucideIcon,
} from 'lucide-react'

export type Offering = {
  title: string
  description: string
}

export type FeatureBand = {
  image: string
  alt: string
  eyebrow: string
  title: string
  text: string
}

export type Business = {
  slug: string
  /** Second word after the AAM wordmark, e.g. "Fishing" */
  name: string
  /** Full display name, e.g. "AAM Fishing" */
  fullName: string
  icon: LucideIcon
  eyebrow: string
  tagline: string
  summary: string
  description: string
  heroAlt: string
  /** Optional real hero photo; falls back to a generated placeholder when absent */
  heroImage?: string
  /** Optional image for the home-page venture card; falls back to heroImage */
  cardImage?: string
  /** Optional editorial feature band shown between offerings and cross-links */
  feature?: FeatureBand
  /** Optional additional editorial feature bands, rendered after `feature` */
  features?: FeatureBand[]
  offerings: Offering[]
  stats: { value: string; label: string }[]
  ctaLabel: string
}

export const BUSINESSES: Business[] = [
  {
    slug: 'fishing',
    name: 'Fishing',
    fullName: 'AAM Fishing',
    icon: Fish,
    eyebrow: 'Sport fishing expeditions',
    tagline: 'Chase the big catch.',
    summary:
      'Guided sport fishing trips for every level — from big-game offshore battles to calm inshore mornings.',
    description:
      'AAM Fishing runs private, crewed expeditions along the coast and out into blue water. Seasoned captains read the conditions, premium tackle waits on board, and every trip is tuned to what you want from the day.',
    heroAlt:
      'A vivid green and gold mahi-mahi leaping clear of deep blue water on the hook, spray flying',
    heroImage: '/images/fishing-mahi.png',
    cardImage: '/images/fishing-wake.png',
    feature: {
      image: '/images/fishing-tuna.png',
      alt: 'A yellowfin tuna with iridescent silver and gold flanks swimming just beneath the surface in deep blue water',
      eyebrow: 'The water we fish',
      title: 'Blue water, world-class fish.',
      text: 'Our grounds hold yellowfin tuna, mahi-mahi, wahoo, and marlin within reach of the coast. We follow the season and the conditions, so every trip puts you where the fish are actually running.',
    },
    features: [
      {
        image: '/images/fishing-biggame-sunset.png',
        alt: 'Big-game trolling rods with gold reels racked on the stern of a boat at sunset, a glowing sun low over calm open water',
        eyebrow: 'Big-game offshore',
        title: 'Heavy tackle, blue-water battles.',
        text: 'Full-day pursuits for tuna, marlin, and dorado with premium two-speed reels and an experienced fighting crew. We run out to the blue water at first light and troll the current lines where the big fish hunt — rods set, drags locked, ready for the strike.',
      },
    ],
    offerings: [
      {
        title: 'Big-game offshore',
        description:
          'Full-day pursuits for tuna, marlin, and dorado with heavy tackle and an experienced fighting crew.',
      },
      {
        title: 'Light-tackle & inshore',
        description:
          'Relaxed half-day trips close to the coast — perfect for families and first-timers.',
      },
      {
        title: 'Gear supplied',
        description:
          'Premium rods, reels, bait, and safety equipment included on every charter.',
      },
      {
        title: 'Catch handling',
        description:
          'Your catch cleaned, filleted, and packed to take home, or released with care.',
      },
    ],
    stats: [
      { value: '15+', label: 'Years guiding' },
      { value: '40ft', label: 'Sport vessel' },
      { value: '20+', label: 'Target species' },
    ],
    ctaLabel: 'Book a fishing trip',
  },
  {
    slug: 'charters',
    name: 'Charters',
    fullName: 'AAM Charters',
    icon: Sailboat,
    eyebrow: 'Private transfers & cruises',
    tagline: 'The coast, on your schedule.',
    summary:
      'Private boat transfers between islands, resorts, and harbors — plus unhurried cruises along the shore.',
    description:
      'AAM Charters moves you across the water in comfort and on time. Point-to-point transfers, day trips to hidden coves, and golden-hour cruises, all crewed and tailored to your plans.',
    heroAlt:
      'A center-console charter boat named Odyssey II with its captain at the helm at golden hour, an island silhouette on the horizon',
    heroImage: '/images/charter-sunset.png',
    offerings: [
      {
        title: 'Island & resort transfers',
        description:
          'Direct private passages between islands, resorts, and marinas — discreet and punctual.',
      },
      {
        title: 'Airport & harbor pickups',
        description:
          'Seamless connections timed to your arrival, with luggage handling on board.',
      },
      {
        title: 'Sunset cruises',
        description:
          'Wind down on the water with refreshments as the coast turns gold.',
      },
      {
        title: 'Custom itineraries',
        description:
          'Multi-stop day trips designed around the coves and beaches you want to see.',
      },
    ],
    stats: [
      { value: '24/7', label: 'Scheduling' },
      { value: '12', label: 'Guests aboard' },
      { value: '360°', label: 'Coastal reach' },
    ],
    ctaLabel: 'Arrange a charter',
  },
  {
    slug: 'boats',
    name: 'Boats',
    fullName: 'AAM Boats',
    icon: Ship,
    eyebrow: 'Boat hire & booking',
    tagline: 'Book your day on the water.',
    summary:
      'Hire our boats for big game fishing, sport fishing, private charters, and excursions — check the calendar and request your date.',
    description:
      'Two boats, one crew. ODYSSEY is our big-game fishing catamaran with twin 200 hp Suzuki engines; ODYSSEY II is our agile vessel for sport fishing, private charters, and island excursions. See when each is free and send your booking request.',
    heroImage: '/images/boats-odyssey.png',
    cardImage: '/images/boats-odyssey.png',
    heroAlt:
      'The ODYSSEY sport fishing boat anchored in turquoise water in front of a lush green forested island under a clear blue sky',
    offerings: [
      {
        title: 'Big game fishing — ODYSSEY',
        description:
          'Our catamaran with twin 200 hp Suzuki engines, built for offshore battles with tuna, marlin, and wahoo.',
      },
      {
        title: 'Sport & inshore fishing — ODYSSEY II',
        description:
          'Lighter-tackle and inshore fishing on our agile vessel, ideal for every level.',
      },
      {
        title: 'Private charters & transfers',
        description:
          'Point-to-point passages between islands, resorts, and marinas — on your schedule.',
      },
      {
        title: 'Excursions & cruises',
        description:
          'Day trips, island tours, and golden-hour cruises along the coast.',
      },
    ],
    stats: [
      { value: '2', label: 'Boats for hire' },
      { value: '2×200', label: 'Suzuki (ODYSSEY)' },
      { value: '4', label: 'Trip types' },
    ],
    ctaLabel: 'Check availability',
  },
  {
    slug: 'shop',
    name: 'Shop',
    fullName: 'AAM Shop',
    icon: ShoppingBag,
    eyebrow: 'Gear & lifestyle store',
    tagline: 'Outfitted for the water.',
    summary:
      'Tackle, marine electronics, apparel, and safety gear — everything on and off the boat, in one store.',
    description:
      'AAM Shop stocks what the crew actually uses. Fishing tackle and marine electronics, dependable safety equipment, and a coastal apparel line — chosen for the water, not the catalogue.',
    heroImage: '/images/shop-lures.png',
    cardImage: '/images/shop-lures.png',
    heroAlt:
      'A row of five colourful big-game trolling lures with glittering skirts and hooks laid out on a sandy towel',
    offerings: [
      {
        title: 'Fishing tackle',
        description:
          'Rods, reels, lures, and terminal tackle from trusted brands and our own picks.',
      },
      {
        title: 'Marine electronics',
        description:
          'Sonar, GPS, and radios — supplied and, if you like, fitted by AAM Marine.',
      },
      {
        title: 'Apparel & lifestyle',
        description:
          'Coastal wear and accessories built to hold up to sun, salt, and spray.',
      },
      {
        title: 'Safety equipment',
        description:
          'Life jackets, flares, and first-aid kits to keep every trip compliant and safe.',
      },
    ],
    stats: [
      { value: '500+', label: 'Products' },
      { value: '20+', label: 'Brands' },
      { value: '1', label: 'Coastal store' },
    ],
    ctaLabel: 'Visit the shop',
  },
  {
    slug: 'island',
    name: 'Island around us',
    fullName: 'The islands around us',
    icon: Compass,
    eyebrow: 'Explore the archipelago',
    tagline: 'The islands that surround us.',
    summary:
      'A guide to the bays, beaches, and islands within reach of our dock — where to go and what to see on the water.',
    description:
      'From sheltered snorkeling coves to fishing villages and white-sand day-stops, the archipelago around us is made for slow exploring. Here is what lies within a short run of the coast, and how our crew can take you there.',
    heroImage: '/images/island-hero-sunset.jpg',
    heroAlt:
      'A green forested island at sunset with soft orange clouds over a blue sky, seen across dark rippling water from a boat',
    feature: {
      image: '/images/nosy-tanikely.png',
      alt: 'Aerial view of Nosy Tanikely — a white sand spit meeting turquoise reef water beside a lush green island, with small boats anchored offshore',
      eyebrow: 'Snorkeling & reef spots',
      title: 'Nosy Tanikely, our finest reef.',
      text: 'A protected marine reserve just off the coast, Nosy Tanikely is ringed by shallow turquoise water and living coral gardens. Turtles, rays, and clouds of reef fish gather here — a short run from our dock and the highlight of any island day.',
    },
    features: [
      {
        image: '/images/nosy-iranja.png',
        alt: 'Aerial view of Nosy Iranja — two green islands joined by a long white sandbar across turquoise reef shallows in a deep blue sea',
        eyebrow: 'Snorkeling & reef spots',
        title: 'Nosy Iranja, the twin islands.',
        text: 'Two islands linked by a long white sandbar that appears at low tide, Nosy Iranja is famous for its clear shallows and gentle reefs. It is a picture-perfect day-stop for swimming, snorkeling, and walking the sand between the islands.',
      },
      {
        image: '/images/nosy-mitsio.png',
        alt: 'Aerial view of Nosy Mitsio — a long curving white sand beach backed by green tropical forest, with calm blue sea and distant islands under a clear sky',
        eyebrow: 'Snorkeling & reef spots',
        title: 'Nosy Mitsio, the far archipelago.',
        text: 'A remote cluster of islands with sweeping empty beaches and untouched reefs, Nosy Mitsio rewards the longer run offshore. Crystal shallows, dramatic basalt cliffs, and some of the finest snorkeling in the region make it a full-day adventure worth the distance.',
      },
      {
        image: '/images/nosy-sakatia.png',
        alt: 'Aerial view of Nosy Sakatia — a green hilly island ringed by turquoise shallows and coral reefs in a deep blue sea, with boats anchored near the shore',
        eyebrow: 'Snorkeling & reef spots',
        title: 'Nosy Sakatia, the orchid island.',
        text: 'A short hop across the channel, Nosy Sakatia is a laid-back green island fringed by seagrass beds and coral. It is one of the best spots to snorkel with sea turtles, with calm bays and quiet beaches that stay peaceful all day.',
      },
      {
        image: '/images/nosy-faly.png',
        alt: 'Aerial view of Nosy Faly — a large low-lying green island with sandy bays and headlands, surrounded by turquoise shallows and reefs in a calm blue sea',
        eyebrow: 'Snorkeling & reef spots',
        title: 'Nosy Faly, the sacred island.',
        text: 'A large, tranquil island steeped in local tradition, Nosy Faly is ringed by shallow turquoise flats and quiet reefs. Its sheltered bays and sandy points make for easy snorkeling and a glimpse of island life far from the crowds.',
      },
      {
        image: '/images/nosy-fahily.png',
        alt: 'Overhead view of Nosy Fahily — a tiny islet with a heart-shaped patch of green forest on a white sand spit, ringed by turquoise water and dark coral formations',
        eyebrow: 'Snorkeling & reef spots',
        title: 'Nosy Fahily, the heart island.',
        text: 'A tiny jewel of an islet crowned with a heart of green forest, Nosy Fahily is surrounded by shallow coral and crystal-clear water. Its sand spit and rock gardens make it one of the prettiest — and most photogenic — snorkeling stops on the coast.',
      },
      {
        image: '/images/nosy-antanimora.png',
        alt: 'Aerial view of Nosy Antanimora — a green forested island with a long white sandbar reaching out into turquoise reef water, waves breaking on both sides',
        eyebrow: 'Snorkeling & reef spots',
        title: 'Nosy Antanimora, the sandbar island.',
        text: 'A green island trailing a dramatic white sandbar into the sea, Nosy Antanimora is framed by shallow reefs where the waves break on either side of the spit. Wade out along the sand and drop in over clear coral — a striking, uncrowded stop on the way offshore.',
      },
      {
        image: '/images/nosy-valiha.png',
        alt: 'Aerial view of Nosy Valiha — a small green forested island with a white sand beach, ringed by wide turquoise coral shallows in a deep blue sea',
        eyebrow: 'Snorkeling & reef spots',
        title: 'Nosy Valiha, the coral garden.',
        text: 'A small green island wrapped in a broad apron of shallow coral, Nosy Valiha offers some of the easiest and most colourful snorkeling around. Slip off the white beach straight into clear turquoise water and drift over living reef just steps from the sand.',
      },
      {
        image: '/images/russian-bay.png',
        alt: 'Aerial view of Russian Bay — winding channels of turquoise water threading through dense green mangrove forest and sandy banks',
        eyebrow: 'Hidden coves & beaches',
        title: 'Russian Bay, the mangrove haven.',
        text: 'A wide, sheltered bay lined with mangroves and quiet sandy beaches, Russian Bay is a calm anchorage away from the open sea. Its winding channels and still turquoise water make it perfect for a lazy swim, a beach lunch, and spotting birdlife along the shore.',
      },
    ],
    offerings: [
      {
        title: 'Hidden coves & beaches',
        description:
          'Quiet white-sand stops and sheltered bays, perfect for swimming, snorkeling, and a beach picnic.',
      },
      {
        title: 'Snorkeling & reef spots',
        description:
          'Clear-water reefs teeming with life, just a short run from the coast and ideal for all levels. Nosy Tanikely — a protected marine reserve of turquoise shallows and coral gardens — is the standout stop.',
      },
      {
        title: 'Island villages',
        description:
          'Visit local fishing communities and markets to see the coast the way the people who live here do.',
      },
      {
        title: 'Viewpoints & sunsets',
        description:
          'Headlands and anchorages that catch the best light — the finest seats for a golden-hour finish.',
      },
    ],
    stats: [
      { value: '10+', label: 'Islands nearby' },
      { value: '30min', label: 'To the first reef' },
      { value: '365', label: 'Days of coast' },
    ],
    ctaLabel: 'Plan an island day',
  },
  {
    slug: 'marine-life',
    name: 'Marine life',
    fullName: 'Marine life',
    icon: Waves,
    eyebrow: 'The waters around us',
    tagline: 'The life beneath the surface.',
    summary:
      'The fish, mammals, and reef creatures that share our waters — what you might meet, and when the seasons bring them close.',
    description:
      'Our coast is alive year-round. Pelagic game fish patrol the blue water, reefs shelter turtles and countless smaller species, and in season whales and dolphins pass close to shore. Here is a look at the wildlife you may encounter out with us.',
    heroImage: '/images/marine-hero.jpg',
    heroAlt:
      'A large fish seen close-up underwater among kelp, with sunlight rays streaming down through clear blue water',
    feature: {
      image: '/images/fishing-sailfish.png',
      alt: 'A sailfish with its tall dorsal fin raised, lit in electric blue, slicing through deep blue open water',
      eyebrow: 'Game fish',
      title: 'Sailfish, the crown of the blue water.',
      text: 'The most spectacular sight offshore — a sailfish lighting up in electric blue and raising its towering sail as it hunts. Blisteringly fast and famous for its leaping runs, it is the prize of the open ocean and the fish every angler dreams of raising.',
    },
    features: [
      {
        image: '/images/fishing-mahi.png',
        alt: 'A mahi-mahi in brilliant gold and green leaping from deep blue water in a burst of spray',
        eyebrow: 'Game fish',
        title: 'Mahi-mahi, the golden fighter.',
        text: 'Unmistakable in gold and green and famous for its acrobatic leaps, the mahi-mahi (dorado) hunts the current lines and floating debris offshore. Fast, hard-fighting, and spectacular on the surface, it is one of the most prized game fish in our waters through the season.',
      },
      {
        image: '/images/fishing-tuna.png',
        alt: 'A yellowfin tuna with metallic gold and blue flanks cruising just beneath the sunlit surface of deep blue water',
        eyebrow: 'Game fish',
        title: 'Yellowfin tuna, the blue-water powerhouse.',
        text: 'Built for speed and stamina, the yellowfin tuna patrols the open blue in fast-moving schools, its long golden finlets flashing as it hunts. A relentless, powerful fighter that tests any angler, it is one of the most sought-after catches offshore through the season.',
      },
    ],
    offerings: [
      {
        title: 'Game fish',
        description:
          'Yellowfin tuna, wahoo, and marlin working the blue water offshore through the season — along with mahi-mahi (dorado), fast and acrobatic in gold and green, hunting the current lines and one of the most spectacular fighters to catch.',
      },
      {
        title: 'Turtles & reef life',
        description:
          'Green and hawksbill turtles, rays, and clouds of reef fish over the shallow coral gardens.',
      },
      {
        title: 'Whales & dolphins',
        description:
          'Pods of dolphins year-round, with humpback whales passing close to the coast in migration season.',
      },
      {
        title: 'Responsible watching',
        description:
          'We keep a respectful distance and follow local guidelines so the wildlife stays wild and undisturbed.',
      },
    ],
    stats: [
      { value: '20+', label: 'Species offshore' },
      { value: '2', label: 'Whale seasons' },
      { value: '365', label: 'Days of life' },
    ],
    ctaLabel: 'Ask about wildlife seasons',
  },
]

export function getBusiness(slug: string): Business | undefined {
  return BUSINESSES.find((b) => b.slug === slug)
}
