import { useToasts, dismiss } from "./toast.js";
// The stack of toasts at the bottom of the window (see toast.js). They slide up and fade in (styles/feedback.css).
export default function Toasts() {
  const list = useToasts();
  return <div className="toasts" role="status" aria-live="polite">{list.map(t => <button key={t.id} className="toast" onClick={() => dismiss(t.id)}>{t.text}</button>)}</div>;
}
