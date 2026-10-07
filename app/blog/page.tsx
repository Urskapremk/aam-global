import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { getAllPosts, formatPostDate } from '@/lib/blog'

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Stories from the water — sport fishing, charters, and coastal life with African Adventures Madagascar on Nosy Komba.',
}

export default function BlogIndexPage() {
  const posts = getAllPosts()

  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden bg-primary">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 80% 60% at 20% 20%, oklch(0.5 0.08 235 / 0.5), transparent), radial-gradient(ellipse 60% 50% at 90% 80%, oklch(0.45 0.06 250 / 0.45), transparent)',
            }}
          />
          <div className="relative mx-auto max-w-7xl px-6 pb-16 pt-32 lg:px-10 lg:pb-20 lg:pt-36">
            <nav className="mb-6 flex items-center gap-2 text-sm text-primary-foreground/70">
              <Link
                href="/"
                className="transition-colors hover:text-primary-foreground"
              >
                AAM
              </Link>
              <span aria-hidden>/</span>
              <span className="text-primary-foreground">Blog</span>
            </nav>
            <p className="mb-4 text-sm uppercase tracking-[0.3em] text-primary-foreground/70">
              From the water
            </p>
            <h1 className="max-w-3xl text-balance font-serif text-5xl font-medium leading-[1.05] text-primary-foreground sm:text-6xl">
              Blog
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-primary-foreground/85">
              Fishing days, island runs, and notes from the AAM crew on Nosy
              Komba.
            </p>
          </div>
        </section>

        <section className="bg-background py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            {posts.length === 0 ? (
              <div className="mx-auto max-w-lg text-center">
                <p className="font-serif text-3xl font-medium text-foreground">
                  No posts yet
                </p>
                <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
                  New stories from the coast will appear here soon. In the
                  meantime, explore our fishing and charter ventures.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                  <Link
                    href="/fishing"
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    AAM Fishing
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/charters"
                    className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    AAM Charters
                  </Link>
                </div>
              </div>
            ) : (
              <ul className="grid gap-10 lg:gap-14">
                {posts.map((post) => (
                  <li key={post.slug}>
                    <article className="group grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-12">
                      <Link
                        href={`/blog/${post.slug}`}
                        className="relative aspect-[16/10] overflow-hidden lg:col-span-6"
                      >
                        <img
                          src={post.heroImage}
                          alt={post.heroAlt}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      </Link>
                      <div className="lg:col-span-6">
                        <p className="text-sm text-muted-foreground">
                          <time dateTime={post.date}>
                            {formatPostDate(post.date)}
                          </time>
                          <span aria-hidden className="mx-2">
                            ·
                          </span>
                          {post.author}
                        </p>
                        <h2 className="mt-3 text-balance font-serif text-3xl font-medium leading-tight text-foreground sm:text-4xl">
                          <Link
                            href={`/blog/${post.slug}`}
                            className="transition-colors hover:text-primary"
                          >
                            {post.title}
                          </Link>
                        </h2>
                        <p className="mt-4 max-w-xl text-pretty leading-relaxed text-muted-foreground">
                          {post.excerpt}
                        </p>
                        {post.tags.length > 0 && (
                          <ul className="mt-5 flex flex-wrap gap-2">
                            {post.tags.map((tag) => (
                              <li
                                key={tag}
                                className="text-xs uppercase tracking-wider text-accent"
                              >
                                {tag}
                              </li>
                            ))}
                          </ul>
                        )}
                        <Link
                          href={`/blog/${post.slug}`}
                          className="group/link mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-accent"
                        >
                          Read article
                          <ArrowRight className="h-4 w-4 transition-transform group-hover/link:translate-x-1" />
                        </Link>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
