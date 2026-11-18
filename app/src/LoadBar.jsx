// A thin bar across the top of the window while something is loading (the first state, a history fetch). It fades in only after a moment, so quick loads do not flash it.
export default function LoadBar({ active }) {
  return <div className={"loadbar" + (active ? " on" : "")} role="progressbar" aria-label="Loading" aria-hidden={!active}><i /></div>;
}
