// The demo shell: a tiny fake that answers a few commands, so `npm run dev` shows the Terminal tab without a real shell.
// `createShell(machine, send)` returns { start(), input(text) }; `send` gets the text the terminal should show.
export const PROMPT = machine => `\x1b[32muser@${String(machine).toLowerCase().replace(/[^a-z0-9]+/g, "-")}\x1b[0m:\x1b[34m~\x1b[0m$ `;
const FILES = ["notes.txt", "runner/", "scripts/", "backup.tar.gz"];
const COMMANDS = {
  help: () => ["Demo shell. Try: help, uptime, ls, whoami, echo hello, clear"],
  uptime: () => [" 09:41:07 up 12 days,  3:25,  1 user,  load average: 0.42, 0.37, 0.31"],
  ls: () => [FILES.join("  ")],
  whoami: () => ["user"],
};
// The lines a typed command prints ("\f" alone means clear the screen).
export function run(line) {
  const [word, ...rest] = line.trim().split(/\s+/);
  if (!word) return [];
  if (word === "clear") return ["\f"];
  if (word === "echo") return [rest.join(" ")];
  return COMMANDS[word] ? COMMANDS[word]() : [`${word}: command not found (this is a demo shell; try help)`];
}
export function createShell(machine, send) {
  let line = "";
  const prompt = () => send(PROMPT(machine));
  return {
    start() { send(`Demo terminal on ${machine}. Type help.\r\n`); prompt(); },
    input(text) {
      for (const ch of text) {
        if (ch === "\r") {
          const out = run(line); line = "";
          send("\r\n");
          if (out[0] === "\f") send("\x1b[2J\x1b[H"); else for (const l of out) send(l + "\r\n");
          prompt();
        } else if (ch === "\x7f") { if (line) { line = line.slice(0, -1); send("\b \b"); } }
        else if (ch >= " ") { line += ch; send(ch); }
      }
    },
  };
}
