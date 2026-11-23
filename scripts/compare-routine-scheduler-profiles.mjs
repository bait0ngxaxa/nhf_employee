import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function load(path) {
    const records = readFileSync(path, "utf8").split(/\r?\n/)
        .flatMap((line) => {
            const payload = line.match(/SCHEDULER_PROFILE (\{.*\})$/)?.[1];
            return payload ? [JSON.parse(payload)] : [];
        });
    const [header, ...scenarios] = records;
    assert.ok(header?.environment, `Missing benchmark environment in ${path}`);
    assert.ok(scenarios.some(({ name }) => name === "resume-repeat"), `Incomplete profile in ${path}`);
    return { environment: header.environment, scenarios };
}

function schedulerOutput(scenario) {
    const runs = scenario.runs ?? [scenario];
    return runs.map(({ result }) => {
        const totals = {};
        for (const scheduler of result) {
            for (const [key, value] of Object.entries(scheduler)) totals[key] = (totals[key] ?? 0) + value;
        }
        return totals;
    });
}

function summarize(scenario) {
    if (scenario.name === "plans-and-cpu") return scenario;
    const runs = scenario.runs ?? [scenario];
    const samples = runs.map(({ queries, serverQueries, result: _result, ...row }) => ({
        elapsed: row.elapsed,
        cpuMs: (row.cpu.user + row.cpu.system) / 1000,
        rss: row.rss,
        heapUsed: row.heapUsed,
        connections: row.connections,
        serverMs: Object.values(serverQueries).reduce((total, entry) => total + entry.ms, 0),
        ...Object.fromEntries(Object.entries(row).filter(([key]) => /^(?:Com_|Innodb_|ER_)/.test(key))),
        prismaStatements: Object.values(queries).reduce((total, entry) => total + entry.count, 0),
    }));
    return {
        name: scenario.name,
        activeTasks: scenario.activeTasks,
        newTasks: scenario.newTasks,
        latency: scenario.latency,
        state: scenario.state,
        counters: schedulerOutput(scenario)[0],
        prismaQueryBreakdown: runs[0].queries,
        queryBreakdown: runs[0].serverQueries,
        samples,
    };
}

const files = process.argv.slice(2);
assert.ok(files.length >= 2, "Provide a reference log and at least one candidate log");
const [reference, ...candidates] = files.map(load);
for (const candidate of candidates) {
    assert.deepEqual(candidate.environment, reference.environment);
    assert.equal(candidate.scenarios.length, reference.scenarios.length);
    for (const [index, scenario] of candidate.scenarios.entries()) {
        const baseline = reference.scenarios[index];
        const label = `${scenario.name} (${scenario.activeTasks ?? "mixed fixture"})`;
        assert.equal(scenario.name, baseline.name);
        assert.equal(scenario.activeTasks, baseline.activeTasks, label);
        assert.deepEqual(scenario.state, baseline.state, label);
        if (scenario.state) assert.deepEqual(schedulerOutput(scenario), schedulerOutput(baseline), label);
    }
}
for (const [index, profile] of [reference, ...candidates].entries()) {
    process.stdout.write(JSON.stringify({
        variant: index === 0 ? "baseline" : `candidate-${index}`,
        environment: profile.environment,
        scenarios: profile.scenarios.map(summarize),
    }) + "\n");
}
