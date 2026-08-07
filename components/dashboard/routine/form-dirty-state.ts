function normalizeSnapshotValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(normalizeSnapshotValue);
    if (typeof value !== "object" || value === null) return value;
    return Object.fromEntries(
        Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => [key, normalizeSnapshotValue(item)]),
    );
}

export function routineFormSnapshot(value: unknown): string {
    return JSON.stringify(normalizeSnapshotValue(value));
}
