import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import {
  getAllPosts,
  getPostBySlug,
  formatPostDate,
} from '@/lib/blog'

type Props = {
  params: Promise<{ slug: string }>
}

/** Inline `**bold**` and `*italic*` (no nesting). */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g
  let last = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index))
    }
    const token = match[0]
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={`b-${key++}`} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>,
      )
    } else {
      nodes.push(
        <em key={`i-${key++}`} className="italic">
          {token.slice(1, -1)}
        </em>,
      )
    }
    last = match.index + token.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

/**
 * Body conventions:
 * - "## Heading" / "### Heading" → section titles
 * - "![alt](/path.jpg)" → full-bleed section figure
 * - "- item" (consecutive) → bullet list
 * - whole-line "*emphasis*" → italic closing line
 * - plain strings → paragraphs (with inline **bold** / *italic*)
 */
function renderBodyBlocks(paragraphs: string[]) {
  const nodes: ReactNode[] = []
  let i = 0
  while (i < paragraphs.length) {
    const paragraph = paragraphs[i]
    if (paragraph.startsWith('### ')) {
      nodes.push(
        <h3
          key={`h3-${i}`}
          className="pt-2 font-serif text-xl font-medium leading-snug text-foreground sm:text-2xl"
        >
          {paragraph.slice(4)}
        </h3>,
      )
      i += 1
      continue
    }
    if (paragraph.startsWith('## ')) {
      nodes.push(
        <h2
          key={`h-${i}`}
          className="pt-4 font-serif text-2xl font-medium leading-snug text-foreground sm:text-3xl"
        >
          {paragraph.slice(3)}
        </h2>,
      )
      i += 1
      continue
    }
    const imageMatch = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(paragraph)
    if (imageMatch) {
      const [, alt, src] = imageMatch
      nodes.push(
        <figure key={`fig-${i}`} className="my-8 -mx-2 sm:-mx-4">
          <img
            src={src}
            alt={alt}
            className="aspect-[16/10] w-full object-cover"
          />
          {alt ? (
            <figcaption className="mt-3 text-sm text-muted-foreground">
              {alt}
            </figcaption>
          ) : null}
        </figure>,
      )
      i += 1
      continue
    }
    if (paragraph.startsWith('- ')) {
      const items: string[] = []
      const start = i
      while (i < paragraphs.length && paragraphs[i].startsWith('- ')) {
        items.push(paragraphs[i].slice(2))
        i += 1
      }
      nodes.push(
        <ul
          key={`ul-${start}`}
          className="list-disc space-y-2 pl-6 marker:text-foreground/50"
        >
          {items.map((item, itemIndex) => (
            <li key={`${start}-${itemIndex}`}>{renderInline(item)}</li>
          ))}
        </ul>,
      )
      continue
    }
    if (
      paragraph.length >= 2 &&
      paragraph.startsWith('*') &&
      paragraph.endsWith('*') &&
      !paragraph.startsWith('**') &&
      paragraph.indexOf('*', 1) === paragraph.length - 1
    ) {
      nodes.push(
        <p key={`em-${i}`} className="italic text-foreground/75">
          {paragraph.slice(1, -1)}
        </p>,
      )
      i += 1
      continue
    }
    nodes.push(<p key={`p-${i}`}>{renderInline(paragraph)}</p>)
    i += 1
  }
  return nodes
}

export async function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return { title: 'Article' }
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: [{ url: post.heroImage, alt: post.heroAlt }],
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  const [lead, ...rest] = post.body

  return (
    <>
      <SiteHeader />
      <main>
        <article>
          <header className="relative min-h-[70vh] overflow-hidden">
            <div className="absolute inset-0">
              <img
                src={post.heroImage}
                alt={post.heroAlt}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-primary/75 via-primary/45 to-primary/90" />
            </div>

            <div className="relative mx-auto flex min-h-[70vh] max-w-7xl flex-col justify-end px-6 pb-14 pt-32 lg:px-10 lg:pb-16">
              <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-background/70">
                <Link
                  href="/"
                  className="transition-colors hover:text-background"
                >
                  AAM
                </Link>
                <span aria-hidden>/</span>
                <Link
                  href="/blog"
                  className="transition-colors hover:text-background"
                >
                  Blog
                </Link>
                <span aria-hidden>/</span>
                <span className="text-background/90">Article</span>
              </nav>

              <p className="mb-4 text-sm uppercase tracking-[0.3em] text-background/70">
                {post.tags[0] ?? 'From the water'}
              </p>
              <h1 className="max-w-4xl text-balance font-serif text-4xl font-medium leading-[1.08] text-background sm:text-5xl lg:text-6xl">
                {post.title}
              </h1>
              <p className="mt-6 text-sm text-background/80">
                <time dateTime={post.date}>{formatPostDate(post.date)}</time>
                <span aria-hidden className="mx-2">
                  ·
                </span>
                {post.author}
              </p>
            </div>
          </header>

          <div className="bg-background py-14 sm:py-20">
            <div className="mx-auto max-w-3xl px-6 lg:px-10">
              {lead && (
                <p className="text-pretty font-serif text-2xl font-medium leading-snug text-foreground sm:text-3xl">
                  {lead}
                </p>
              )}
              <div className="mt-10 space-y-6 text-pretty text-lg leading-relaxed text-foreground/85">
                {renderBodyBlocks(rest)}
              </div>

              <div className="mt-14 flex flex-col gap-4 border-t border-border pt-10 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  href="/blog"
                  className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  All posts
                </Link>
                <Link
                  href="/fishing"
                  className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Book a fishing trip
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  )
}
