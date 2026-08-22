import { useEffect, useRef, useState } from 'react'
import { SectionLabel } from '../ui/SectionLabel'
import type { Message } from '../lobby/LobbyChat'
import { useI18n } from '../../lib/i18n'

interface DraftChatProps {
  messages: Message[]
  onSend: (body: string) => void
  you: string
}

const MESSAGE_MAX = 140

/**
 * Chat, anchored to the bottom of the left column and running upward — newest
 * at the bottom, input beneath it, which is where every messaging surface has
 * put them for twenty years.
 *
 * It stays live for the whole draft, including while the clock is on you. The
 * room talking through a pick is most of the reason anyone drafts with friends
 * instead of alone, so this is not a thing that gets suspended when the screen
 * gets busy. It is also the only region on the page that scrolls.
 */
export function DraftChat({ messages, onSend, you }: DraftChatProps) {
  const { t } = useI18n();

  const [draft, setDraft] = useState('')
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const log = logRef.current
    if (log) log.scrollTop = log.scrollHeight
  }, [messages])

  return (
    <section aria-label={t("Draft chat")} className="draft-chat min-h-0 flex-1 flex-col justify-end">
      <SectionLabel className="shrink-0">{t("Chat")}</SectionLabel>

      <div
        ref={logRef}
        aria-live="polite"
        className="scroller mt-[8px] min-h-0 flex-1 overflow-y-auto border-t border-line pt-[9px]"
      >
        {messages.length === 0 ? (
          <p className="text-[11px] leading-[1.5] text-faint">{t("Nobody has said anything yet.")}</p>
        ) : (
          <ul className="flex flex-col justify-end gap-[5px]">
            {messages.map((message) => (
              <li key={message.id} className="fx fx-soft text-[11px] leading-[1.45]">
                {message.kind === 'system' ? (
                  <span className="font-display text-[9.5px] font-medium uppercase tracking-[0.16em] text-faint">
                    {message.body}
                  </span>
                ) : (
                  <>
                    <span
                      className={[
                        'mr-[7px] font-display text-[10px] font-medium uppercase tracking-[0.12em]',
                        message.author === you ? 'text-accent' : 'text-live',
                      ].join(' ')}
                    >
                      {message.author}
                    </span>
                    <span className="text-ink">{message.body}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          const body = draft.trim()
          if (!body) return
          onSend(body)
          setDraft('')
        }}
        className="mt-[8px] shrink-0"
      >
        <label className="sr-only" htmlFor="draft-chat-field">{t("Message the room")}</label>
        <input
          id="draft-chat-field"
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, MESSAGE_MAX))}
          placeholder={t("Message the room")}
          autoComplete="off"
          className="w-full rounded-sm border border-line bg-ground/60 px-[10px] py-[7px] font-sans text-[11.5px] text-ink transition-colors duration-100 ease-out hover:border-line-strong focus:border-accent-line focus:outline-none"
        />
      </form>
    </section>
  )
}
