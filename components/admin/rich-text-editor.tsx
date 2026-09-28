'use client'

import { useEffect, useRef } from 'react'
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link2,
  RemoveFormatting,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  /** Reports the current HTML and plain-text content on every edit. */
  onChange: (html: string, text: string) => void
  placeholder?: string
  /** Change this value to clear the editor (e.g. after sending). */
  resetSignal?: number
}

type Cmd = {
  icon: typeof Bold
  label: string
  run: (exec: (c: string, v?: string) => void) => void
}

const COMMANDS: Cmd[] = [
  { icon: Bold, label: 'Bold', run: (x) => x('bold') },
  { icon: Italic, label: 'Italic', run: (x) => x('italic') },
  { icon: Underline, label: 'Underline', run: (x) => x('underline') },
  { icon: List, label: 'Bullet list', run: (x) => x('insertUnorderedList') },
  {
    icon: ListOrdered,
    label: 'Numbered list',
    run: (x) => x('insertOrderedList'),
  },
  {
    icon: Link2,
    label: 'Insert link',
    run: (x) => {
      const url = window.prompt('Link URL (https://…)')
      if (url) x('createLink', url)
    },
  },
  {
    icon: RemoveFormatting,
    label: 'Clear formatting',
    run: (x) => x('removeFormat'),
  },
]

export function RichTextEditor({ onChange, placeholder, resetSignal }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  function emit() {
    const el = ref.current
    if (!el) return
    const html = el.innerHTML === '<br>' ? '' : el.innerHTML
    onChange(html, el.innerText.trim())
  }

  function exec(command: string, value?: string) {
    ref.current?.focus()
    // execCommand is deprecated but remains the simplest cross-browser way to
    // do lightweight rich-text editing without extra dependencies.
    document.execCommand(command, false, value)
    emit()
  }

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = ''
      onChange('', '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal])

  return (
    <div className="overflow-hidden rounded-lg border border-input bg-background">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-input bg-muted/40 p-1.5">
        {COMMANDS.map((c) => (
          <button
            key={c.label}
            type="button"
            title={c.label}
            aria-label={c.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => c.run(exec)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          >
            <c.icon className="h-4 w-4" strokeWidth={1.5} />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="Message"
        data-placeholder={placeholder}
        onInput={emit}
        className={cn(
          'min-h-[220px] px-3.5 py-3 text-sm leading-relaxed text-foreground outline-none',
          'empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]',
          '[&_a]:text-primary [&_a]:underline',
          '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5',
          '[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5',
        )}
      />
    </div>
  )
}
