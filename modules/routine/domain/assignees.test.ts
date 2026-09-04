import { describe, expect, it } from "vitest";

import {
    addRoutineAssignee,
    normalizeRoutineAssignees,
    removeRoutineAssignee,
    setRoutineAssigneeRole,
} from "./assignees";

describe("Routine assignee role transitions", () => {
    it("assigns the first employee as OWNER and later employees as CO_OWNER", () => {
        const first = addRoutineAssignee({}, 11);
        const second = addRoutineAssignee(first, 22);

        expect(first).toEqual({ 11: "OWNER" });
        expect(second).toEqual({ 11: "OWNER", 22: "CO_OWNER" });
    });

    it("promotes a selected CO_OWNER and demotes the previous OWNER", () => {
        expect(setRoutineAssigneeRole({ 11: "OWNER", 22: "CO_OWNER" }, 22, "OWNER"))
            .toEqual({ 11: "CO_OWNER", 22: "OWNER" });
    });

    it("promotes another employee when the OWNER is removed", () => {
        expect(removeRoutineAssignee({ 11: "OWNER", 22: "CO_OWNER" }, 11))
            .toEqual({ 22: "OWNER" });
    });

    it("does not allow a non-empty state to lose its only OWNER", () => {
        expect(setRoutineAssigneeRole({ 11: "OWNER" }, 11, "CO_OWNER"))
            .toEqual({ 11: "OWNER" });
        expect(normalizeRoutineAssignees({ 11: "CO_OWNER", 22: "CO_OWNER" }))
            .toEqual({ 11: "OWNER", 22: "CO_OWNER" });
    });

    it("keeps at most one OWNER after every role transition", () => {
        const transitions = [
            addRoutineAssignee({ 11: "OWNER" }, 22),
            removeRoutineAssignee({ 11: "OWNER", 22: "CO_OWNER" }, 22),
            setRoutineAssigneeRole({ 11: "OWNER", 22: "CO_OWNER" }, 22, "OWNER"),
        ];

        for (const state of transitions) {
            expect(Object.values(state).filter((role) => role === "OWNER")).toHaveLength(1);
        }
    });
});
