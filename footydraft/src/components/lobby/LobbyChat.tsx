import { useEffect, useRef, useState } from 'react'
import { SectionLabel } from '../ui/SectionLabel'
import { useI18n } from '../../lib/i18n'

export interface Message {
  id: number
  /** A join or a leave, drawn as a rule of text rather than as somebody talking. */
  kind: 'system' | 'said'
  author: string
  body: string
}

interface LobbyChatProps {
  messages: Message[]
  onSend: (body: string) => void
  /** Yours are drawn in the accent; everyone else's are ink. */
  you: string
}

const MESSAGE_MAX = 140

/**
 * The lobby's chat, which stays open the whole time a lobby exists — during a
 * draft too, once there is one.
 *
 * It sits in the space the solo lobby left empty under the table. The log is
 * the one scrolling region in the app: the page itself never scrolls, but a
 * conversation has to go somewhere. Hidden on a short viewport, where the
 * seats and the settings need every pixel.
 */
export function LobbyChat({ messages, onSend, you }: LobbyChatProps) {
  const { t } = useI18n();

  const [draft, setDraft] = useState('')
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const log = logRef.current
    if (log) log.scrollTop = log.scrollHeight
  }, [messages])

  return (
    <section
      aria-label={t("Lobby chat")}
      className="lobby-chat fx fx-soft mt-[var(--lobby-gap)] min-h-0 flex-1 flex-col"
      style={{ animationDelay: '620ms' }}
    >
      <SectionLabel className="shrink-0">{t("Chat")}</SectionLabel>

      <div
        ref={logRef}
        aria-live="polite"
        className="chat-log mt-[clamp(0.35rem,1.2vh,0.625rem)] min-h-0 flex-1 overflow-y-auto border-t border-line pt-[clamp(0.4rem,1.4vh,0.75rem)]"
      >
        {messages.length === 0 ? (
          <p className="text-[11.5px] leading-[1.5] text-faint">{t("Nobody has said anything yet.")}</p>
        ) : (
          <ul className="flex flex-col gap-[clamp(0.25rem,0.9vh,0.5rem)]">
            {messages.map((message) => (
              <li key={message.id} className="fx fx-soft text-[11.5px] leading-[1.45]">
                {message.kind === 'system' ? (
                  <span className="font-display text-[10px] font-medium uppercase tracking-[0.16em] text-faint">
                    {message.body}
                  </span>
                ) : (
                  <>
                    <span
                      className={[
                        'mr-2 font-display text-[10.5px] font-medium uppercase tracking-[0.12em]',
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
        className="mt-[clamp(0.35rem,1.2vh,0.625rem)] flex shrink-0 items-stretch gap-2"
      >
        <label className="sr-only" htmlFor="lobby-chat-field">{t("Message the lobby")}</label>
        <input
          id="lobby-chat-field"
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, MESSAGE_MAX))}
          placeholder={t("Message the lobby")}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-sm border border-line bg-ground/60 px-3 py-[9px] font-sans text-[12px] text-ink transition-colors duration-100 ease-out hover:border-line-strong focus:border-accent-line focus:outline-none"
        />
        <button
          type="submit"
          disabled={draft.trim().length === 0}
          className="shrink-0 rounded-sm border border-line-strong px-4 font-display text-[10px] font-medium uppercase tracking-[0.16em] text-muted transition-colors duration-150 ease-out hover:border-ink hover:text-ink disabled:border-line disabled:text-faint disabled:hover:border-line disabled:hover:text-faint"
        >{t("Send")}</button>
      </form>
    </section>
  )
}
