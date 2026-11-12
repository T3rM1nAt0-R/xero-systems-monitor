#!/bin/sh
# probe.sh: prints one tagged line per fact about this Linux machine.
#
# It is sent over one long-lived ssh connection and run in a loop by the sender,
# which ends every frame with a line "@@END". Nothing here reads stdin or writes a file.
# Two switches come in through the environment: F=1 on the first frame and every 100th
# (hardware names change rarely), P=1 on the first frame and every 5th (the process
# list costs about half a second). Every command may fail; a failed fact prints no line.
#
# Line format: TAG followed by space separated values (the last value may hold spaces).
#   cpu a b c d e f g h        first line of /proc/stat: user nice system idle iowait irq softirq steal
#   MEM total_kb available_kb  from /proc/meminfo
#   DISK 42%                   use of the root file system
#   DF dev size used avail pct mount    one per real file system, sizes in MiB with an M
#   TEMPS sensor millidegrees  one per sensor (hwmon name, or tz-<type> for thermal zones)
#   GPU util_pct, temp_c, mem_used_mib, mem_total_mib    or "GPU none"
#   NET iface ip speed_mbps rx_bytes tx_bytes uptime_s  default route; "-" when no ip, -1 when no speed
#   PING ms                    round trip to a public resolver
#   RUNNER <ps args>           a GitHub Actions Runner.Listener or Runner.Worker process
#   JOB runner name repo ref head_ref   a job running now; "-" for unknown, "_" stands for a space in name
#   JOBRES runner cpu_pct ram_mb vram_mb    resources of that job's process tree; vram_mb is "-" when unknown
#   JRES runner result logfile  a job that finished within the last minute
#   SVCF unit                  a failed systemd unit
#   DOCKON                     docker is installed
#   DOCK name|state|status|image|ports|running_for    one per container
#   DOCKERR text               docker is installed but did not answer
#   TOP cpu_pct ram_mb count name    busiest programs (cpu_pct is of the whole machine)
#   HW cpu|gpu|os|board text   hardware names (only when F=1)

nvq() { nvidia-smi --query-gpu="$1" --format=csv,noheader,nounits 2>/dev/null | head -1; }

head -1 /proc/stat
awk '/MemTotal/{t=$2}/MemAvailable/{a=$2}END{print "MEM",t,a}' /proc/meminfo
df -P / | awk 'NR==2{print "DISK",$5}'

if [ -n "$F" ]; then
  c=$(lscpu 2>/dev/null | sed -n 's/^Model name: *//p' | head -1)
  [ -n "$c" ] || c=$(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2 | sed 's/^ *//')
  echo "HW cpu $c ($(nproc) threads)"
  echo "HW gpu $(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)"
  echo "HW os $(. /etc/os-release 2>/dev/null; echo "$PRETTY_NAME")"
  echo "HW board $(cat /sys/class/dmi/id/product_name 2>/dev/null)"
fi

for h in /sys/class/hwmon/hwmon*; do
  n=$(cat "$h/name" 2>/dev/null)
  for f in "$h"/temp*_input; do
    [ -r "$f" ] && echo "TEMPS $n $(cat "$f" 2>/dev/null)"
  done
done
for z in /sys/class/thermal/thermal_zone*; do
  [ -r "$z/temp" ] && echo "TEMPS tz-$(tr ' ' _ <"$z/type" 2>/dev/null) $(cat "$z/temp" 2>/dev/null)"
done

df -P -BM -x tmpfs -x devtmpfs -x squashfs -x overlay -x efivarfs 2>/dev/null | tail -n +2 | sed 's/^/DF /'

n=$(nvq utilization.gpu,temperature.gpu,memory.used,memory.total)
echo "GPU ${n:-none}"

d=$(awk '$2=="00000000"{print $1; exit}' /proc/net/route 2>/dev/null)
if [ -n "$d" ]; then
  ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  speed=$(cat "/sys/class/net/$d/speed" 2>/dev/null || echo -1)
  echo "NET $d ${ip:--} $speed $(awk -v d="$d:" '$1==d{print $2,$10}' /proc/net/dev) $(cut -d' ' -f1 /proc/uptime)"
fi

# One JOB line per running Runner.Worker, read from the newest worker log of its runner.
for pid in $(pgrep -f Runner.Worker); do
  r=$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null | sed -n 's|^\(.*\)/bin[.0-9]*/Runner.Worker.*|\1|p')
  [ -n "$r" ] || r=$(readlink "/proc/$pid/cwd" 2>/dev/null | sed 's|/bin[.0-9]*$||')
  [ -d "$r/_diag" ] || continue
  log=$(ls -t "$r"/_diag/Worker_*.log 2>/dev/null | head -1)
  field() { grep -m1 -oE "\"$1\": *\"$2\"" "$log" 2>/dev/null | cut -d'"' -f4; }
  if [ -z "$log" ]; then
    name="(runner_log_not_readable)"
  else
    name=$(field jobDisplayName '[^"]*' | tr ' ' _)
    [ -n "$name" ] || name="(no_job_name_in_log)"
  fi
  repo=$(field repository '[^"]*')
  ref=$(field ref 'refs/[^"]*')
  head=$(field head_ref '[^"]*')
  event="$r/_work/_temp/_github_workflow/event.json"
  if [ -z "$ref" ] && [ -r "$event" ]; then
    x=$(python3 -c 'import json,sys;e=json.load(open(sys.argv[1]));p=e.get("pull_request") or {};print(("refs/pull/%s/merge"%p["number"]) if p else (e.get("ref") or "-"),(p.get("head") or {}).get("ref") or "-")' "$event" 2>/dev/null)
    [ -n "$x" ] && ref=${x% *} && head=${x#* }
  fi
  echo "JOB $(basename "$r") ${name:--} ${repo:--} ${ref:--} ${head:--}"
done

# JOBRES: CPU and memory of each worker's process tree over 0.4 s, plus its docker containers.
pgrep -f Runner.Worker >/dev/null && python3 - <<'PY' 2>/dev/null
import os, re, time, subprocess, shutil
def snap():
    d = {}
    for p in os.listdir("/proc"):
        if p.isdigit():
            try:
                s = open("/proc/%s/stat" % p).read(); f = s[s.rindex(")") + 2:].split()
                d[int(p)] = (int(f[1]), int(f[11]) + int(f[12]), int(f[21]))
            except Exception: pass
    return d
def tree(d, root):
    kids = {}
    for p, (pp, _, _) in d.items(): kids.setdefault(pp, []).append(p)
    out, todo = [], [root]
    while todo:
        x = todo.pop(); out.append(x); todo += kids.get(x, [])
    return out
def sh(c):
    try: return subprocess.run(c, capture_output=True, text=True, timeout=4).stdout
    except Exception: return ""
workers = {}
for p in os.listdir("/proc"):
    if p.isdigit():
        try:
            c = open("/proc/%s/cmdline" % p, "rb").read().replace(b"\0", b" ").decode(errors="replace")
            m = re.match(r"(.*)/bin[.0-9]*/Runner\.Worker", c)
            if m: workers[int(p)] = m.group(1)
        except Exception: pass
if workers:
    a = snap(); t0 = time.time(); time.sleep(0.4); b = snap(); dt = time.time() - t0
    hz = os.sysconf("SC_CLK_TCK"); nc = os.cpu_count() or 1; page = os.sysconf("SC_PAGE_SIZE")
    vr = {}
    for l in sh(["nvidia-smi", "--query-compute-apps=pid,used_memory", "--format=csv,noheader,nounits"]).splitlines():
        q = [x.strip() for x in l.split(",")]
        if len(q) == 2 and q[0].isdigit() and q[1].isdigit(): vr[int(q[0])] = int(q[1])
    dock = {}
    if shutil.which("docker"):
        ids = sh(["docker", "ps", "-q"]).split()
        if ids:
            mounts = {}
            for l in sh(["docker", "inspect", "-f", "{{.Id}} {{range .Mounts}}{{.Source}} {{end}}"] + ids).splitlines():
                q = l.split(None, 1)
                if len(q) == 2: mounts[q[0][:12]] = q[1]
            stats = {}
            units = {"KiB": 1 / 1024, "MiB": 1, "GiB": 1024, "kB": 1 / 1000, "MB": 1, "GB": 1000}
            for l in sh(["docker", "stats", "--no-stream", "--format", "{{.ID}} {{.CPUPerc}} {{.MemUsage}}"] + ids).splitlines():
                st = l.split()
                try:
                    mem = st[2]; num = re.match(r"[\d.]+", mem).group()
                    stats[st[0][:12]] = (float(st[1].strip("%")), float(num) * units.get(mem[len(num):], 1))
                except Exception: pass
            for cid, src in mounts.items():
                for w, r in workers.items():
                    if cid in stats and (r + "/" in src + "/" or r in src):
                        e = dock.setdefault(w, [0, 0]); e[0] += stats[cid][0]; e[1] += stats[cid][1]
    for w, r in workers.items():
        pids = [x for x in tree(b, w) if x in b]
        cpu = sum(b[x][1] - a[x][1] for x in pids if x in a) / hz / dt / nc * 100
        ram = sum(b[x][2] for x in pids) * page / 1048576
        g = [vr[x] for x in pids if x in vr]
        if w in dock: cpu += dock[w][0] / nc; ram += dock[w][1]
        print("JOBRES %s %.1f %.0f %s" % (os.path.basename(r), cpu, ram, sum(g) if g else "-"))
PY

ps -eo args | grep -E "[R]unner\.(Listener|Worker)" | sed 's/^/RUNNER /'
ping -c1 -W1 1.1.1.1 2>/dev/null | sed -n 's/.*time=\([0-9.]*\).*/PING \1/p'

# JRES: a worker log touched in the last minute that already holds a job result.
for r in $(ps -eo args | sed -n 's|^\(/[^ ]*\)/bin[.0-9]*/Runner\.Listener.*|\1|p' | sort -u); do
  for l in $(find "$r/_diag" -maxdepth 1 -name 'Worker_*.log' -mmin -1 2>/dev/null); do
    x=$(grep -m1 -oE 'Job result after all job steps finish: [A-Za-z]+' "$l" 2>/dev/null | sed 's/.*: //')
    [ -n "$x" ] && echo "JRES $(basename "$r") $x $(basename "$l")"
  done
done

command -v systemctl >/dev/null && timeout 3 systemctl --failed --no-legend --plain 2>/dev/null | awk 'NF{print "SVCF",$1}'

if command -v docker >/dev/null; then
  echo DOCKON
  o=$(timeout 3 docker ps -a --format 'DOCK {{.Names}}|{{.State}}|{{.Status}}|{{.Image}}|{{.Ports}}|{{.RunningFor}}' 2>&1)
  echo "$o" | grep '^DOCK '
  echo "$o" | grep -v '^DOCK ' | head -1 | sed 's/^/DOCKERR /'
fi

# TOP: the six busiest programs over 0.5 s, grouped by process name.
[ -n "$P" ] && python3 - <<'PY' 2>/dev/null
import os, time
def snap():
    d = {}
    for p in os.listdir("/proc"):
        if p.isdigit():
            try:
                s = open("/proc/%s/stat" % p).read(); i = s.rindex(")"); f = s[i + 2:].split()
                d[int(p)] = (s[s.index("(") + 1:i], int(f[11]) + int(f[12]), int(f[21]))
            except Exception: pass
    return d
a = snap(); t0 = time.time(); time.sleep(0.5); b = snap(); dt = time.time() - t0
hz = os.sysconf("SC_CLK_TCK"); nc = os.cpu_count() or 1; page = os.sysconf("SC_PAGE_SIZE")
agg = {}
for p, (n, t, r) in b.items():
    c = (t - a[p][1]) / hz / dt * 100 / nc if p in a else 0
    e = agg.setdefault(n, [0.0, 0.0, 0]); e[0] += c; e[1] += r * page / 1048576; e[2] += 1
for n, (c, r, k) in sorted(agg.items(), key=lambda x: -(x[1][0] * 1000 + x[1][1]))[:6]:
    print("TOP %.1f %.0f %d %s" % (c, r, k, n.replace(" ", "_")))
PY
exit 0
