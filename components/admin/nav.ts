import {
  Compass,
  ShoppingBag,
  Type,
  Anchor,
  Inbox,
  Ship,
  Fish,
  Wind,
  Map,
  MapPin,
  Route,
  Wrench,
  Fuel,
  BarChart3,
  Users,
  ShieldCheck,
  Coins,
  Globe,
  IdCard,
  type LucideIcon,
} from 'lucide-react'

// Admin navigation model. This module has NO 'use client' directive on purpose:
// both the client AdminShell and the server Overview landing page import NAV,
// and a value exported from a 'use client' module is not readable on the
// server. Keeping it here makes NAV a plain shared constant for both.

export type NavLeaf = {
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
  badge?: boolean
  bookingBadge?: boolean
}
export type NavGroup = {
  label: string
  icon: LucideIcon
  children: NavLeaf[]
}
export type NavNode = NavLeaf | NavGroup

export const isGroup = (n: NavNode): n is NavGroup => 'children' in n

// Single source of truth for the admin navigation. The Overview landing page
// also reads this to build its tile grid, so a nav change shows up there too.
export const NAV: NavNode[] = [
  { href: '/admin', label: 'Overview', icon: Anchor, exact: true },
  { href: '/admin/inbox', label: 'Mail', icon: Inbox, badge: true },
  // Weather sits high up: wind, sea and tide decide whether a boat sails at
  // all, so it is read before anything that assumes it does.
  { href: '/admin/weather', label: 'Weather', icon: Wind },
  // Fleet is a collapsible section grouping everything about the boats: the
  // live map, bookings, trips, fishing, Odyssey pricing and excursions all
  // hang off it. `Map` for the group; boats carry no AIS, so an icon implying
  // live tracking would over-promise.
  {
    label: 'Fleet',
    icon: Map,
    children: [
      // Fleet map first — the group's own landing screen ("where are the
      // boats"). `Map` matches the group header.
      { href: '/admin/fleet', label: 'Fleet map', icon: Map },
      { href: '/admin/bookings', label: 'Boat bookings', icon: Ship, bookingBadge: true },
      // Trips is the log behind the map: where the boat has been. `Route`
      // because a trip is a completed track, not a schedule.
      { href: '/admin/trips', label: 'Trips', icon: Route },
      // Fishing: what came off the trips. `MapPin` and not `Fish`, which means
      // Odyssey pricing below — two identical icons would read as one entry.
      { href: '/admin/fishing', label: 'Fishing', icon: MapPin },
      { href: '/admin/odyssey', label: 'Odyssey pricing', icon: Fish },
      { href: '/admin/excursions', label: 'Excursions', icon: Compass },
      // Maintenance lives with the fleet: everything above assumes the boats
      // run, and this is where that stops being an assumption. `Wrench` rather
      // than a gauge or calendar — the schedule is only read in order to work.
      { href: '/admin/maintenance', label: 'Maintenance', icon: Wrench },
    ],
  },
  // Exchange rate: the rate that turns every Ariary cost into the EUR + Rand
  // reference shown across the app. `Coins` because it is money, not a place.
  { href: '/admin/exchange', label: 'Exchange rate', icon: Coins },
  // Owner report is a collapsible section grouping the money/records screens:
  // the monthly summary plus the fuel store, crew payroll and compliance that
  // feed it. `BarChart3` for the group — it is about numbers, not operations.
  {
    label: 'Owner report',
    icon: BarChart3,
    children: [
      // The summary itself first — the group's landing screen.
      { href: '/admin/reports', label: 'Owner report', icon: BarChart3 },
      // Fuel: a running-cost store — how much is in the drums and when to
      // reorder. `Fuel` (a pump) is unambiguous.
      { href: '/admin/fuel', label: 'Fuel', icon: Fuel },
      // Crew payroll: hours off the trips turned into money. `Users` because
      // the row is a person.
      { href: '/admin/crew', label: 'Crew payroll', icon: Users },
      // HR department: staff records, Madagascar payroll, contracts, leave and
      // the employer register, built on the same crew names as Crew payroll.
      { href: '/admin/hr', label: 'HR department', icon: IdCard },
      // Compliance & logbooks: trips, catches, documents and safety records
      // turned into the official record for each vessel. `ShieldCheck` because
      // this is the screen that certifies the boat is legal.
      { href: '/admin/compliance', label: 'Compliance', icon: ShieldCheck },
    ],
  },
  // Web is a collapsible section grouping the public-site screens: what
  // visitors see on aamcharters.com. `Globe` because it is the outward-facing
  // website, not an operational tool.
  {
    label: 'Web',
    icon: Globe,
    children: [
      // Shop products first — the group's landing screen.
      { href: '/admin/products', label: 'Shop products', icon: ShoppingBag },
      { href: '/admin/content', label: 'Texts & images', icon: Type },
      // Public-site traffic & visitor geography (first-party + Vercel headers).
      { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
]
