import { useRef, useState } from "react";
import { BACKGROUNDS, GLASS_LEVELS, IMAGE_MAX, valueOf } from "../theme/model.js";
import { fullColors } from "../theme/css.js";
import { readPicture } from "../theme/os.js";
import { useMicaSetting } from "../useMica.js";
import { usePersisted } from "../store.js";
import { Row, Range, Seg, Toggle } from "./controls.jsx";
// Surfaces: glass, its tint, the window background (solid, gradient or a picture from disk), grain, and the Windows accent colour.
export default function SurfacesSection({ c }) {
  const v = f => valueOf(c.look, "surface." + f), set = f => x => c.edit(["surface", f], x), file = useRef(null), [msg, setMsg] = useState("");
  const choose = async f => { if (!f) return; setMsg("Reading the picture..."); const url = await readPicture(f, IMAGE_MAX); setMsg(url ? "" : "That picture could not be used (too big or not a picture)."); if (url) c.editMany([["surface.image", url], ["surface.bg", "image"]]); };
  const [mica, setMica] = useMicaSetting(), [micaState] = usePersisted("micaState", "off");
  return (
    <>
      <Row id="surface.glass" label="Glass" keys="frosted blur transparent flat" c={c} hint="Frosted cards, menus and bars. Off is plain and flat. It also turns off by itself when Windows asks for less transparency.">
        <Seg label="Glass" value={v("glass")} options={GLASS_LEVELS} onChange={set("glass")} /></Row>
      <Row id="surface.tint" label="Glass tint" keys="glass colour color tint card" c={c}>
        <input type="color" aria-label="Glass tint colour" value={v("tint") || fullColors(c.look, c.base).card} onChange={e => set("tint")(e.target.value)} /><span className="chint">{v("tint") ? "Custom" : "Match card"}</span></Row>
      <Row id="surface.bg" label="Background" keys="solid gradient image picture wallpaper photo" c={c}>
        <Seg label="Background" value={v("bg")} options={BACKGROUNDS} onChange={set("bg")} />
        {v("bg") === "image" && <><button className="small" onClick={() => file.current?.click()}>{v("image") ? "Change picture..." : "Choose picture..."}</button>{v("image") && <button className="small" onClick={() => c.editMany([["surface.image", undefined], ["surface.bg", undefined]])}>Remove</button>}</>}
        <input ref={file} type="file" accept="image/*" hidden aria-label="Background picture" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; choose(f); }} />
        {msg && <span className="chint" role="status">{msg}</span>}</Row>
      <Row id="surface.grain" label="Grain" keys="noise film texture" c={c}><Range value={v("grain")} min={0} max={100} label="Grain" ends={["None", "Heavy"]} show={x => (x ? x + "%" : "Off")} onChange={set("grain")} /></Row>
      <Row id="surface.os" label="Use Windows accent colour" keys="system accent follow os windows match" c={c} hint="Use the system accent colour where the window can read it. Dark, Light or Windows is chosen under Theme.">
        <Toggle on={v("os")} onChange={x => c.edit(["surface", "os"], x)} label="Use Windows accent colour" /></Row>
      <Row id="surface.mica" label="Mica behind glass" keys="mica backdrop windows 11 transparent blur" c={null} hint={micaState === "unsupported" ? "Windows could not draw it here (it needs Windows 11), so the window stays solid." : "Let the Windows 11 backdrop show through the glass. Needs Windows 11; anywhere else the window stays solid."}>
        <Toggle on={mica} onChange={setMica} label="Mica behind glass" /></Row>
    </>);
}
