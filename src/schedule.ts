import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir, homedir, userInfo } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type ScheduleAction = "status" | "install" | "remove";

export type ClockTime = { hour: number; minute: number };

const DEFAULT_TIME: ClockTime = { hour: 18, minute: 0 };

export function parseClock(value: string): ClockTime {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error(`--at must be HH:MM (got "${value}").`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new Error(`--at must be a real time of day (got "${value}").`);
  }
  return { hour, minute };
}

export function taskIdForConfig(configPath: string): string {
  return createHash("sha256").update(path.resolve(configPath)).digest("hex").slice(0, 8);
}

function cliScriptPath(): string {
  const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
  if (invoked.endsWith(`${path.sep}cli.js`)) return invoked;
  return fileURLToPath(new URL("./cli.js", import.meta.url));
}

/** The process this install should schedule: this node, this CLI, this config. */
export function scheduledArgv(configPath: string): string[] {
  return [process.execPath, cliScriptPath(), "--scheduled", "--config", path.resolve(configPath)];
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatClock(time: ClockTime): string {
  return `${pad(time.hour)}:${pad(time.minute)}`;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function quoteArg(value: string): string {
  if (!/[\s"]/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

export function renderWindowsTaskXml(argv: string[], time: ClockTime): string {
  const [command, ...rest] = argv;
  const today = new Date();
  const boundary = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T${formatClock(time)}:00`;
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>IngotVault daily mirror. Exit 2 means the vault drive was missing.</Description>
  </RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>${boundary}</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByDay>
        <DaysInterval>1</DaysInterval>
      </ScheduleByDay>
    </CalendarTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT2H</ExecutionTimeLimit>
    <Enabled>true</Enabled>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${xmlEscape(command)}</Command>
      <Arguments>${xmlEscape(rest.map(quoteArg).join(" "))}</Arguments>
    </Exec>
  </Actions>
</Task>
`;
}

export function renderLaunchAgentPlist(
  label: string,
  argv: string[],
  time: ClockTime,
): string {
  const args = argv
    .map((arg) => `    <string>${xmlEscape(arg)}</string>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlEscape(label)}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>${time.hour}</integer>
    <key>Minute</key>
    <integer>${time.minute}</integer>
  </dict>
  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
`;
}

export function renderSystemdService(argv: string[]): string {
  const exec = argv.map((arg) => (/[\s"]/.test(arg) ? quoteArg(arg) : arg)).join(" ");
  return `[Unit]
Description=IngotVault mirror

[Service]
Type=oneshot
ExecStart=${exec}
`;
}

export function renderSystemdTimer(time: ClockTime): string {
  return `[Unit]
Description=IngotVault daily mirror

[Timer]
OnCalendar=*-*-* ${formatClock(time)}:00
Persistent=true

[Install]
WantedBy=timers.target
`;
}

export function renderCronLine(id: string, argv: string[], time: ClockTime): string {
  const cmd = argv.map(quoteArg).join(" ");
  return `${time.minute} ${time.hour} * * * ${cmd} # ingotvault ${id}`;
}

function run(command: string, args: string[], input?: string): { ok: boolean; stdout: string; stderr: string; status: number | null } {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    windowsHide: true,
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status,
  };
}

function windowsTaskName(id: string): string {
  return `\\IngotVault\\${id}`;
}

function describePlan(kind: string, when: string, argv: string[], catchUp: string): string {
  return [
    `scheduler: ${kind}`,
    `when: daily at ${when} local`,
    `catch-up: ${catchUp}`,
    `command: ${argv.map(quoteArg).join(" ")}`,
    "does not pass --force-with-lease",
  ].join("\n");
}

function installWindows(id: string, argv: string[], time: ClockTime, dryRun: boolean): number {
  const name = windowsTaskName(id);
  const plan = describePlan(
    "Task Scheduler",
    formatClock(time),
    argv,
    "runs once when the computer is next on if it was off at that time",
  );
  console.log(plan);
  console.log(`task: ${name}`);
  if (dryRun) return 0;
  const xmlPath = path.join(tmpdir(), `ingotvault-${id}.xml`);
  const xml = renderWindowsTaskXml(argv, time);
  writeFileSync(xmlPath, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(xml, "utf16le")]));
  const created = run("schtasks", ["/Create", "/F", "/TN", name, "/XML", xmlPath]);
  rmSync(xmlPath, { force: true });
  if (!created.ok) {
    console.error(created.stderr || created.stdout || "schtasks /Create failed");
    return 1;
  }
  console.log("installed");
  return 0;
}

function statusWindows(id: string): number {
  const name = windowsTaskName(id);
  const queried = run("schtasks", ["/Query", "/TN", name, "/FO", "LIST"]);
  if (!queried.ok) {
    console.log(`not installed (${name})`);
    return 0;
  }
  console.log(queried.stdout.trim());
  return 0;
}

function removeWindows(id: string, dryRun: boolean): number {
  const name = windowsTaskName(id);
  console.log(`remove task: ${name}`);
  if (dryRun) return 0;
  const removed = run("schtasks", ["/Delete", "/TN", name, "/F"]);
  if (!removed.ok) {
    console.error(removed.stderr || removed.stdout || "schtasks /Delete failed");
    return 1;
  }
  console.log("removed");
  return 0;
}

function launchAgentPath(label: string): string {
  return path.join(homedir(), "Library", "LaunchAgents", `${label}.plist`);
}

function installMac(id: string, argv: string[], time: ClockTime, dryRun: boolean): number {
  const label = `dev.ingotvault.${id}`;
  const plistPath = launchAgentPath(label);
  const plan = describePlan(
    "launchd LaunchAgent",
    formatClock(time),
    argv,
    "launchd runs the job after wake if the computer was asleep at that minute",
  );
  console.log(plan);
  console.log(`plist: ${plistPath}`);
  if (dryRun) return 0;
  mkdirSync(path.dirname(plistPath), { recursive: true });
  writeFileSync(plistPath, renderLaunchAgentPlist(label, argv, time));
  const domain = `gui/${userInfo().uid}`;
  run("launchctl", ["bootout", domain, plistPath]);
  const loaded = run("launchctl", ["bootstrap", domain, plistPath]);
  if (!loaded.ok) {
    console.error(loaded.stderr || loaded.stdout || "launchctl bootstrap failed");
    return 1;
  }
  console.log("installed");
  return 0;
}

function statusMac(id: string): number {
  const label = `dev.ingotvault.${id}`;
  const plistPath = launchAgentPath(label);
  const printed = run("launchctl", ["print", `gui/${userInfo().uid}/${label}`]);
  if (!printed.ok) {
    console.log(`not installed (${plistPath})`);
    return 0;
  }
  console.log(`installed: ${plistPath}`);
  return 0;
}

function removeMac(id: string, dryRun: boolean): number {
  const label = `dev.ingotvault.${id}`;
  const plistPath = launchAgentPath(label);
  console.log(`remove plist: ${plistPath}`);
  if (dryRun) return 0;
  run("launchctl", ["bootout", `gui/${userInfo().uid}`, plistPath]);
  rmSync(plistPath, { force: true });
  console.log("removed");
  return 0;
}

function systemdNames(id: string): { service: string; timer: string; dir: string } {
  const dir = path.join(homedir(), ".config", "systemd", "user");
  return {
    dir,
    service: path.join(dir, `ingotvault-${id}.service`),
    timer: path.join(dir, `ingotvault-${id}.timer`),
  };
}

function systemdUserWorks(): boolean {
  return run("systemctl", ["--user", "--version"]).ok;
}

function installLinux(id: string, argv: string[], time: ClockTime, dryRun: boolean): number {
  if (systemdUserWorks()) {
    const names = systemdNames(id);
    const plan = describePlan(
      "systemd user timer",
      formatClock(time),
      argv,
      "Persistent=true runs a missed day the next time you log in",
    );
    console.log(plan);
    console.log(`timer: ${names.timer}`);
    if (dryRun) return 0;
    mkdirSync(names.dir, { recursive: true });
    writeFileSync(names.service, renderSystemdService(argv));
    writeFileSync(names.timer, renderSystemdTimer(time));
    const unit = `ingotvault-${id}.timer`;
    const reloaded = run("systemctl", ["--user", "daemon-reload"]);
    const enabled = run("systemctl", ["--user", "enable", "--now", unit]);
    if (!reloaded.ok || !enabled.ok) {
      console.error(enabled.stderr || reloaded.stderr || "systemctl --user enable failed");
      return 1;
    }
    console.log("installed");
    return 0;
  }

  const line = renderCronLine(id, argv, time);
  const plan = describePlan(
    "cron (systemd --user is not available)",
    formatClock(time),
    argv,
    "none — cron skips the run if the machine is off",
  );
  console.log(plan);
  console.log(`cron: ${line}`);
  if (dryRun) return 0;
  const existing = run("crontab", ["-l"]);
  const kept = (existing.ok ? existing.stdout : "")
    .split("\n")
    .filter((row) => row.trim() && !row.includes(`# ingotvault ${id}`));
  kept.push(line);
  const written = run("crontab", ["-"], `${kept.join("\n")}\n`);
  if (!written.ok) {
    console.error(written.stderr || "crontab failed");
    return 1;
  }
  console.log("installed");
  return 0;
}

function statusLinux(id: string): number {
  if (systemdUserWorks()) {
    const unit = `ingotvault-${id}.timer`;
    const printed = run("systemctl", ["--user", "status", unit, "--no-pager"]);
    if (!printed.ok && !printed.stdout && !printed.stderr.includes(unit)) {
      console.log(`not installed (${unit})`);
      return 0;
    }
    console.log((printed.stdout || printed.stderr).trim());
    return 0;
  }
  const existing = run("crontab", ["-l"]);
  const line = (existing.stdout || "").split("\n").find((row) => row.includes(`# ingotvault ${id}`));
  console.log(line ? `installed: ${line}` : "not installed (cron)");
  return 0;
}

function removeLinux(id: string, dryRun: boolean): number {
  if (systemdUserWorks()) {
    const names = systemdNames(id);
    const unit = `ingotvault-${id}.timer`;
    console.log(`remove ${unit}`);
    if (dryRun) return 0;
    run("systemctl", ["--user", "disable", "--now", unit]);
    rmSync(names.timer, { force: true });
    rmSync(names.service, { force: true });
    run("systemctl", ["--user", "daemon-reload"]);
    console.log("removed");
    return 0;
  }
  console.log(`remove cron line # ingotvault ${id}`);
  if (dryRun) return 0;
  const existing = run("crontab", ["-l"]);
  const kept = (existing.ok ? existing.stdout : "")
    .split("\n")
    .filter((row) => row.trim() && !row.includes(`# ingotvault ${id}`));
  const written = run("crontab", ["-"], kept.length ? `${kept.join("\n")}\n` : "");
  if (!written.ok) {
    console.error(written.stderr || "crontab failed");
    return 1;
  }
  console.log("removed");
  return 0;
}

export function runSchedule(options: {
  action: ScheduleAction;
  configPath: string;
  at: string | null;
  dryRun: boolean;
}): number {
  const id = taskIdForConfig(options.configPath);
  const argv = scheduledArgv(options.configPath);
  const time = options.at ? parseClock(options.at) : DEFAULT_TIME;
  console.log(`config: ${path.resolve(options.configPath)}`);
  console.log(`id: ${id}`);

  if (process.platform === "win32") {
    if (options.action === "status") return statusWindows(id);
    if (options.action === "remove") return removeWindows(id, options.dryRun);
    return installWindows(id, argv, time, options.dryRun);
  }
  if (process.platform === "darwin") {
    if (options.action === "status") return statusMac(id);
    if (options.action === "remove") return removeMac(id, options.dryRun);
    return installMac(id, argv, time, options.dryRun);
  }
  if (options.action === "status") return statusLinux(id);
  if (options.action === "remove") return removeLinux(id, options.dryRun);
  return installLinux(id, argv, time, options.dryRun);
}
