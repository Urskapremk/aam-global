// Editable site content: config + defaults. No 'use server' here so both
// server components and the client editor can import the field list.

export type ContentField = {
  key: string
  label: string
  type: 'text' | 'textarea' | 'image'
  group: string
  hint?: string
}

export const CONTENT_FIELDS: ContentField[] = [
  // Home hero
  {
    key: 'home.hero.eyebrow',
    label: 'Eyebrow (small label)',
    type: 'text',
    group: 'Home — Hero',
  },
  {
    key: 'home.hero.title',
    label: 'Title',
    type: 'text',
    group: 'Home — Hero',
  },
  {
    key: 'home.hero.subtitle',
    label: 'Subtitle',
    type: 'textarea',
    group: 'Home — Hero',
  },
  {
    key: 'home.hero.image',
    label: 'Background photo',
    type: 'image',
    group: 'Home — Hero',
  },
  // About
  {
    key: 'about.eyebrow',
    label: 'Eyebrow (small label)',
    type: 'text',
    group: 'Home — About',
  },
  {
    key: 'about.title',
    label: 'Title',
    type: 'text',
    group: 'Home — About',
  },
  {
    key: 'about.paragraph',
    label: 'Paragraph',
    type: 'textarea',
    group: 'Home — About',
  },
  {
    key: 'about.image',
    label: 'Photo',
    type: 'image',
    group: 'Home — About',
  },
]

export const CONTENT_DEFAULTS: Record<string, string> = {
  'home.hero.eyebrow': 'Nosy Komba · Madagascar',
  'home.hero.title': 'A coastal group built around the water.',
  'home.hero.subtitle':
    'African Adventures Madagascar brings together sport fishing, private charters, marine services, and a gear store — separate ventures, one standard of care, all from our base on Nosy Komba.',
  'home.hero.image': '/images/fishing-sailfish.png',
  'about.eyebrow': 'About AAM',
  'about.title': 'Built by people who never left the water',
  'about.paragraph':
    'African Adventures Madagascar grew out of a simple idea: everything you need on the water off Nosy Komba should come from one trusted name. What started with fishing now spans charters, marine services, and a gear store — each run with the same hands-on care.',
  'about.image': '/images/crew-odyssey.png',
}

/** Merge DB overrides over the built-in defaults. */
export function mergeContent(overrides: Record<string, string>) {
  return { ...CONTENT_DEFAULTS, ...overrides }
}
