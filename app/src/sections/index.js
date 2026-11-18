import { SECTION_META } from "./meta.js";
import Cpu from "./Cpu.jsx";
import Gpu from "./Gpu.jsx";
import Battery from "./Battery.jsx";
import Net from "./Net.jsx";
import Disk from "./Disk.jsx";
import Runners from "./Runners.jsx";
import Services from "./Services.jsx";
// The registry the window draws from: each section's facts (meta.js, pure) joined to the component that draws its body.
// Detail.jsx renders from this list; a tab shows `SECTIONS.filter(s => s.tab === tab)`.
const BODY = { cpu: Cpu, gpu: Gpu, bat: Battery, net: Net, disk: Disk, run: Runners, svc: Services };
export const SECTIONS = SECTION_META.map(s => ({ ...s, Component: BODY[s.id] }));
export { TABS, TAB_IDS, SECTION_IDS, sectionTitle } from "./meta.js";
