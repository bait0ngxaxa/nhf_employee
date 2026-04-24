export const EXPORT_LIMITS = {
    employee: {
        maxRows: 2000,
        batchSize: 250,
    },
    leave: {
        maxRows: 3000,
        batchSize: 250,
    },
    stock: {
        maxRows: 5000,
        batchSize: 250,
    },
} as const;
