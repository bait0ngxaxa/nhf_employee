"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, Search, X } from "lucide-react";
import {
    TICKET_CATEGORIES,
    TICKET_PRIORITIES,
    TICKET_STATUSES,
} from "@/constants/tickets";

interface TicketFilters {
    status: string;
    category: string;
    priority: string;
    search: string;
}

interface TicketFiltersCardProps {
    filters: TicketFilters;
    onFiltersChange: React.Dispatch<React.SetStateAction<TicketFilters>>;
}

export function TicketFiltersCard({
    filters,
    onFiltersChange,
}: TicketFiltersCardProps) {
    return (
        <Card className="overflow-hidden border-indigo-100/80 bg-gradient-to-br from-white/95 via-slate-50/90 to-sky-50/80 shadow-[0_22px_50px_-40px_rgba(30,41,59,0.42)]">
            <CardHeader className="border-b border-indigo-100/80 bg-gradient-to-r from-white to-indigo-50/70">
                <CardTitle className="flex items-center gap-2 text-slate-800">
                    <span className="rounded-lg bg-indigo-100 p-1.5 text-indigo-700">
                        <Filter className="h-4 w-4" />
                    </span>
                    ตัวกรอง
                </CardTitle>
            </CardHeader>
            <CardContent className="bg-gradient-to-b from-white/35 to-sky-50/45">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Search */}
                    <div className="space-y-2 rounded-xl border border-slate-200/80 bg-white/80 p-3 shadow-sm">
                        <label htmlFor="ticket-search" className="text-sm font-medium text-slate-700">ค้นหา</label>
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                            <Input
                                id="ticket-search"
                                aria-label="ค้นหา ticket"
                                placeholder="ค้นหาหัวข้อหรือรายละเอียด…"
                                value={filters.search}
                                onChange={(e) =>
                                    onFiltersChange((prev) => ({
                                        ...prev,
                                        search: e.target.value,
                                    }))
                                }
                                className="pl-8 border-slate-200 bg-white"
                            />
                            {filters.search.trim().length > 0 && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                        onFiltersChange((prev) => ({
                                            ...prev,
                                            search: "",
                                        }))
                                    }
                                    className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full text-slate-400 hover:bg-slate-200/70 hover:text-slate-600"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Status */}
                    <div className="space-y-2 rounded-xl border border-slate-200/80 bg-white/80 p-3 shadow-sm">
                        <label className="text-sm font-medium text-slate-700">สถานะ</label>
                        <Select
                            value={filters.status || undefined}
                            onValueChange={(value) =>
                                onFiltersChange((prev) => ({
                                    ...prev,
                                    status: value === "all" ? "" : value,
                                }))
                            }
                        >
                            <SelectTrigger className="border-slate-200 bg-white">
                                <SelectValue placeholder="ทุกสถานะ" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">ทุกสถานะ</SelectItem>
                                {TICKET_STATUSES.map((status) => (
                                    <SelectItem
                                        key={status.value}
                                        value={status.value}
                                    >
                                        {status.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Category */}
                    <div className="space-y-2 rounded-xl border border-slate-200/80 bg-white/80 p-3 shadow-sm">
                        <label className="text-sm font-medium text-slate-700">หมวดหมู่</label>
                        <Select
                            value={filters.category || undefined}
                            onValueChange={(value) =>
                                onFiltersChange((prev) => ({
                                    ...prev,
                                    category: value === "all" ? "" : value,
                                }))
                            }
                        >
                            <SelectTrigger className="border-slate-200 bg-white">
                                <SelectValue placeholder="ทุกหมวดหมู่" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
                                {TICKET_CATEGORIES.map((category) => (
                                    <SelectItem
                                        key={category.value}
                                        value={category.value}
                                    >
                                        {category.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Priority */}
                    <div className="space-y-2 rounded-xl border border-slate-200/80 bg-white/80 p-3 shadow-sm">
                        <label className="text-sm font-medium text-slate-700">ความสำคัญ</label>
                        <Select
                            value={filters.priority || undefined}
                            onValueChange={(value) =>
                                onFiltersChange((prev) => ({
                                    ...prev,
                                    priority: value === "all" ? "" : value,
                                }))
                            }
                        >
                            <SelectTrigger className="border-slate-200 bg-white">
                                <SelectValue placeholder="ทุกระดับ" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">ทุกระดับ</SelectItem>
                                {TICKET_PRIORITIES.map((priority) => (
                                    <SelectItem
                                        key={priority.value}
                                        value={priority.value}
                                    >
                                        {priority.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                </div>
            </CardContent>
        </Card>
    );
}
