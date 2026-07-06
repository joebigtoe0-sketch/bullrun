import { useEffect, useRef, useState } from 'react';
import { CHAT_MAX_LEN } from '@bullrun/shared';
import { emitChat } from '../hooks/useSocket';
import { useGameStore } from '../store/gameStore';

export function ChatPanel() {
  const chatLog = useGameStore((s) => s.chatLog);
  const userId = useGameStore((s) => s.user?.id);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatLog.length]);

  const send = () => {
    const msg = text.trim();
    if (!msg) return;
    emitChat(msg);
    setText('');
  };

  return (
    <div className={`chat-panel${open ? '' : ' collapsed'}`}>
      <button type="button" className="chat-toggle" onClick={() => setOpen((v) => !v)}>
        Chat {open ? '▾' : '▸'}
      </button>
      {open && (
        <>
          <div className="chat-log" ref={logRef}>
            {chatLog.length === 0 && (
              <div className="chat-line muted">Say hello to other players…</div>
            )}
            {chatLog.map((m, i) => (
              <div key={`${m.at}-${m.id}-${i}`} className={`chat-line${m.id === userId ? ' mine' : ''}`}>
                <span className="chat-name">{m.displayName}</span>
                <span className="chat-text">{m.text}</span>
              </div>
            ))}
          </div>
          <form
            className="chat-input-row"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              className="chat-input"
              value={text}
              maxLength={CHAT_MAX_LEN}
              placeholder="Message…"
              onChange={(e) => setText(e.target.value)}
            />
            <button type="submit" className="br-btn sm gold" disabled={!text.trim()}>
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
}
