// LINE-specific helper functions
// Note: getPriorityLabel and getStatusLabel are available from @/lib/helpers/ticket-helpers
// Use getTicketPriorityLabel and getTicketStatusLabel instead

export function getPriorityEmoji(priority: string): string {
    const emojis: Record<string, string> = {
        LOW: "🟢",
        MEDIUM: "🟡",
        HIGH: "🟠",
        URGENT: "🔴",
    };
    return emojis[priority] || "⚪";
}

export function getPriorityColor(priority: string): string {
    const colors: Record<string, string> = {
        LOW: "#6B7280",
        MEDIUM: "#3B82F6",
        HIGH: "#F59E0B",
        URGENT: "#EF4444",
    };
    return colors[priority] || "#6B7280";
}

export function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}
