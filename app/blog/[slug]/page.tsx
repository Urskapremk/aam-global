import type { Metadata } from 'next'
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
                {rest.map((paragraph) => (
                  <p key={paragraph.slice(0, 48)}>{paragraph}</p>
                ))}
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
