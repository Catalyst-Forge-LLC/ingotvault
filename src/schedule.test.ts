import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatClock,
  parseClock,
  renderCronLine,
  renderLaunchAgentPlist,
  renderSystemdTimer,
  renderWindowsTaskXml,
  taskIdForConfig,
} from "./schedule.js";

describe("schedule", () => {
  it("parses a clock time and rejects junk", () => {
    assert.deepEqual(parseClock("18:00"), { hour: 18, minute: 0 });
    assert.deepEqual(parseClock("7:05"), { hour: 7, minute: 5 });
    assert.equal(formatClock(parseClock("7:05")), "07:05");
    assert.throws(() => parseClock("25:00"), /real time/);
    assert.throws(() => parseClock("evening"), /HH:MM/);
  });

  it("uses a stable id for one config path", () => {
    const a = taskIdForConfig("C:/vault/ingotvault.config.json");
    const b = taskIdForConfig("C:/vault/ingotvault.config.json");
    const c = taskIdForConfig("C:/other/ingotvault.config.json");
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.equal(a.length, 8);
  });

  it("asks Task Scheduler to catch up and not to wake the machine", () => {
    const xml = renderWindowsTaskXml(
      ["C:/Program Files/nodejs/node.exe", "C:/cli.js", "--scheduled", "--config", "C:/cfg.json"],
      { hour: 18, minute: 30 },
    );
    assert.match(xml, /<StartWhenAvailable>true<\/StartWhenAvailable>/);
    assert.match(xml, /<WakeToRun>false<\/WakeToRun>/);
    assert.match(xml, /<MultipleInstancesPolicy>IgnoreNew<\/MultipleInstancesPolicy>/);
    assert.match(xml, /T18:30:00/);
    assert.doesNotMatch(xml, /force-with-lease/);
  });

  it("writes a launchd calendar and a persistent systemd timer", () => {
    const plist = renderLaunchAgentPlist(
      "dev.ingotvault.abcd1234",
      ["/usr/bin/node", "/cli.js", "--scheduled"],
      { hour: 21, minute: 15 },
    );
    assert.match(plist, /<integer>21<\/integer>/);
    assert.match(plist, /<integer>15<\/integer>/);
    const timer = renderSystemdTimer({ hour: 18, minute: 0 });
    assert.match(timer, /OnCalendar=\*-\*-\* 18:00:00/);
    assert.match(timer, /Persistent=true/);
    const cron = renderCronLine("abcd1234", ["/usr/bin/node", "/cli.js"], { hour: 18, minute: 5 });
    assert.match(cron, /^5 18 \* \* \* /);
    assert.match(cron, /# ingotvault abcd1234$/);
  });
});
