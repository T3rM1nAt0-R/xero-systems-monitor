#!/bin/sh
# probe.sh: prints one tagged line per fact about this Linux machine.
#
# It is sent over one long-lived ssh connection and run in a loop by the sender,
# which ends every frame with a line "@@END". Nothing here reads stdin.
# Switches come in through the environment: F=1 on the first frame and every 100th
# (hardware names change rarely), P=1 on the first frame and every 5th (the process
# list costs about half a second), D=1 on the first frame and every 3rd (docker stats
# are slow, so the other frames reuse the last ones). T is a scratch folder the sender
# keeps for the whole connection (GPU samples, the last process snapshot, the last docker
# stats); without it each frame makes and removes its own. Every command may fail; a failed
# fact prints no line.
#
# Line format: TAG followed by space separated values (the last value may hold spaces).
#   cpu a b c d e f g h        first line of /proc/stat: user nice system idle iowait irq softirq steal
#   cpuN a b c ...             the same counters for core N (one line per core)
#   MEM total_kb available_kb  from /proc/meminfo
#   DISK 42%                   use of the root file system
#   DF dev size used avail pct mount    one per real file system, sizes in MiB with an M
#   TEMPS sensor millidegrees  one per sensor (hwmon name, or tz-<type> for thermal zones)
#   CTEMP n millidegrees       temperature of CPU core n (Intel coretemp labels "Core n")
#   FAN rpm                    one per fan the hardware monitor chips report
#   MHZ n                      average CPU clock from /proc/cpuinfo
#   BAT pct state minutes      the battery: charge, state word (Charging, Discharging, Full), minutes left or "-"
#   GPUAPP mib pid name        a program using the NVIDIA card (only when P=1); "GPUAPP -" when none
#   GPU util_pct, temp_c, mem_used_mib, mem_total_mib    or "GPU none"; util and mem_used are the
#                              peaks of the samples nvidia-smi took while the frame ran
#   DISKIO dev read_bps write_bps       speed of each whole drive since the last frame (needs the scratch folder T; none on the first frame)
#   SMART dev|model|health|temp|hours|wear    drive health from smartctl (ok or warning; empty = unknown), read every 10 minutes and repeated from a cache
#   SMARTNOTE missing | denied   no smartctl installed, or it needs more rights than this user has
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
#   REBOOT 0 | REBOOT 1 count  Debian/Ubuntu only: /var/run/reboot-required exists, and how many packages asked
#   UPDATES n                  updates waiting, from apt-check (only when F=1, only where it is installed; no root needed)

# GPU bursts are short, so one sample per frame misses them: nvidia-smi runs in the background
# (one launch, a sample every GPU_GAP_MS) while the rest of the frame works, and the PEAK use
# and PEAK memory of everything it saw are reported. Nothing sleeps for it.
GPU_GAP_MS=250

nvq() { nvidia-smi --query-gpu="$1" --format=csv,noheader,nounits 2>/dev/null | head -1; }

if [ -z "$T" ]; then T=$(mktemp -d 2>/dev/null) && trap 'rm -rf "$T"' EXIT; D=1; fi
export T D
gpusamp=
if command -v nvidia-smi >/dev/null && [ -n "$T" ]; then
  nvidia-smi --query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total --format=csv,noheader,nounits -lms "$GPU_GAP_MS" >"$T/gpu" 2>/dev/null &
  gpusamp=$!
fi

grep '^cpu' /proc/stat
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

# Restart state: only distros that keep dpkg say so in a file; elsewhere it stays unknown.
if [ -d /var/lib/dpkg ]; then
  if [ -e /var/run/reboot-required ]; then
    echo "REBOOT 1 $(grep -c . /var/run/reboot-required.pkgs 2>/dev/null || echo 0)"
  else
    echo "REBOOT 0"
  fi
fi
if [ -n "$F" ] && [ -x /usr/lib/update-notifier/apt-check ]; then
  u=$(timeout 5 /usr/lib/update-notifier/apt-check 2>&1 | sed -n 's/^\([0-9][0-9]*\);.*/\1/p')
  [ -n "$u" ] && echo "UPDATES $u"
fi

for h in /sys/class/hwmon/hwmon*; do
  n=$(cat "$h/name" 2>/dev/null)
  for f in "$h"/temp*_input; do
    [ -r "$f" ] || continue
    echo "TEMPS $n $(cat "$f" 2>/dev/null)"
    if [ "$n" = coretemp ]; then
      l=$(cat "${f%_input}_label" 2>/dev/null)
      case "$l" in "Core "*) echo "CTEMP ${l#Core } $(cat "$f" 2>/dev/null)" ;; esac
    fi
  done
  for f in "$h"/fan*_input; do
    [ -r "$f" ] && echo "FAN $(cat "$f" 2>/dev/null)"
  done
done
awk '/^cpu MHz/{s+=$4;n++}END{if(n)printf "MHZ %.0f\n",s/n}' /proc/cpuinfo 2>/dev/null
for b in /sys/class/power_supply/BAT*; do
  [ -r "$b/capacity" ] || continue
  awk -v b="$b" 'function rd(f,  v){v="";getline v < (b "/" f);close(b "/" f);return v+0}
    BEGIN{getline c < (b "/capacity");getline st < (b "/status");
      now=rd("energy_now");full=rd("energy_full");rate=rd("power_now");
      if(!rate){now=rd("charge_now");full=rd("charge_full");rate=rd("current_now")}
      m="-";if(rate>0){if(st=="Discharging")m=int(now/rate*60);else if(st=="Charging")m=int((full-now)/rate*60)}
      gsub(/ /,"_",st);print "BAT",c,st,m}'
  break
done
for z in /sys/class/thermal/thermal_zone*; do
  [ -r "$z/temp" ] && echo "TEMPS tz-$(tr ' ' _ <"$z/type" 2>/dev/null) $(cat "$z/temp" 2>/dev/null)"
done

df -P -BM -x tmpfs -x devtmpfs -x squashfs -x overlay -x efivarfs 2>/dev/null | tail -n +2 | sed 's/^/DF /'

# Drive speed: /proc/diskstats counters against the last frame's (kept in $T), timed by uptime.
if [ -n "$T" ]; then
  awk -v up="$(cut -d' ' -f1 /proc/uptime)" -v old="$T/dio" '
    BEGIN { while ((getline l < old) > 0) { split(l, a, " "); if (a[1] == "t") pt = a[2]; else { pr[a[1]] = a[2]; pw[a[1]] = a[3] } } }
    $3 ~ /^(sd[a-z]+|vd[a-z]+|xvd[a-z]+|nvme[0-9]+n[0-9]+|mmcblk[0-9]+)$/ {
      r = $6 * 512; w = $10 * 512; print $3, r, w > (old ".new")
      if (pt != "" && up > pt && ($3 in pr) && r >= pr[$3] && w >= pw[$3]) printf "DISKIO %s %d %d\n", $3, (r - pr[$3]) / (up - pt), (w - pw[$3]) / (up - pt)
    }
    END { print "t", up > (old ".new") }' /proc/diskstats 2>/dev/null
  mv "$T/dio.new" "$T/dio" 2>/dev/null
fi

# Drive health: smartctl needs no sudo on some systems. It is slow, so it runs in the background every 10 minutes and the answer is cached in $T.
if [ -n "$T" ]; then
  if ! find "$T/smart" -mmin -10 2>/dev/null | grep -q .; then
    touch "$T/smart"
    (if command -v smartctl >/dev/null; then
      for dev in $(lsblk -dno NAME,TYPE 2>/dev/null | awk '$2=="disk"{print $1}'); do
        timeout 5 smartctl -H -A -i "/dev/$dev" 2>/dev/null | awk -v n="$dev" '
          /Device Model|Model Number|Product:/ { sub(/^[^:]*: */, ""); gsub(/ /, "_"); m = $0 }
          /overall-health|Health Status/ { h = ($NF == "PASSED" || $NF == "OK") ? "ok" : "warning" }
          $1 == 194 || $1 == 190 { t = $10 }
          /^Temperature:/ { t = $2 }
          $1 == 9 { o = $10 }
          /^Power On Hours:/ { gsub(/,/, "", $4); o = $4 }
          $2 ~ /Wear_Leveling|Media_Wearout|Lifetime_Remain|SSD_Life_Left/ { w = 100 - $4 }
          /^Percentage Used:/ { w = $3 + 0 }
          END { if (h) printf "SMART %s|%s|%s|%s|%s|%s\n", n, m, h, t, o, w }'
      done >"$T/smart.new"
      [ -s "$T/smart.new" ] || echo "SMARTNOTE denied" >"$T/smart.new"
    else
      echo "SMARTNOTE missing" >"$T/smart.new"
    fi
    mv "$T/smart.new" "$T/smart" 2>/dev/null) >/dev/null 2>&1 &
  fi
  cat "$T/smart" 2>/dev/null
fi

# The sampler has been running since the top of the frame; stop it and take the peaks.
n=
if [ -n "$gpusamp" ]; then
  kill "$gpusamp" 2>/dev/null; wait "$gpusamp" 2>/dev/null
  n=$(grep -E '^[0-9]' "$T/gpu" 2>/dev/null | awk -F', *' 'NR==1{t=$2;tot=$4} {if($1+0>u)u=$1+0; if($3+0>m)m=$3+0} END{if(NR)print u", "t", "m", "tot}')
fi
[ -n "$n" ] || n=$(nvq utilization.gpu,temperature.gpu,memory.used,memory.total)
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

# JOBRES: CPU and memory of each worker's process tree since the last frame (no sleep once a
# frame has run), plus its docker containers (asked on D frames, the last answer reused between).
pgrep -f Runner.Worker >/dev/null && python3 - <<'PY' 2>/dev/null
import os, re, time, json, subprocess, shutil
T = os.environ.get("T", "")
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
def load(name, keep_s):
    try:
        with open(os.path.join(T, name)) as f: v = json.load(f)
        if 0 < time.time() - v["t"] < keep_s: return v
    except Exception: pass
    return None
def save(name, v):
    try:
        with open(os.path.join(T, name), "w") as f: json.dump(v, f)
    except Exception: pass
workers = {}
for p in os.listdir("/proc"):
    if p.isdigit():
        try:
            c = open("/proc/%s/cmdline" % p, "rb").read().replace(b"\0", b" ").decode(errors="replace")
            m = re.match(r"(.*)/bin[.0-9]*/Runner\.Worker", c)
            if m: workers[int(p)] = m.group(1)
        except Exception: pass
if workers:
    b = snap(); now = time.time()
    prev = load("snap.json", 30)
    if prev:
        a = {int(k): tuple(v) for k, v in prev["d"].items()}; dt = now - prev["t"]
    else:
        a = b; t0 = time.time(); time.sleep(0.4); b = snap(); now = time.time(); dt = now - t0
    save("snap.json", {"t": now, "d": b})
    hz = os.sysconf("SC_CLK_TCK"); nc = os.cpu_count() or 1; page = os.sysconf("SC_PAGE_SIZE")
    vr = {}
    for l in sh(["nvidia-smi", "--query-compute-apps=pid,used_memory", "--format=csv,noheader,nounits"]).splitlines():
        q = [x.strip() for x in l.split(",")]
        if len(q) == 2 and q[0].isdigit() and q[1].isdigit(): vr[int(q[0])] = int(q[1])
    dock = {}
    cached = load("dock.json", 30)
    if cached and not os.environ.get("D"):
        dock = {int(k): v for k, v in cached["d"].items()}
    elif shutil.which("docker"):
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
        save("dock.json", {"t": time.time(), "d": dock})
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

# GPUAPP: programs using the NVIDIA card (pmon lists graphics and compute ones, in MiB), only on P frames.
if [ -n "$P" ] && command -v nvidia-smi >/dev/null; then
  nvidia-smi pmon -c 1 -s m 2>/dev/null | awk '/^ *[0-9]/ && $2 ~ /^[0-9]+$/ && $4 ~ /^[0-9]+$/ {print "GPUAPP", $4, $2, $NF}'
  echo "GPUAPP -"
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
