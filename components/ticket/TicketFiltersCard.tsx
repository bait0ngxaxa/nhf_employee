"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Filter, Search } from "lucide-react";
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
    onReset: () => void;
}

export function TicketFiltersCard({
    filters,
    onFiltersChange,
    onReset,
}: TicketFiltersCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    ตัวกรอง
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Search */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">ค้นหา</label>
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                            <Input
                                placeholder="ค้นหาหัวข้อหรือรายละเอียด"
                                value={filters.search}
                                onChange={(e) =>
                                    onFiltersChange((prev) => ({
                                        ...prev,
                                        search: e.target.value,
                                    }))
                                }
                                className="pl-8"
                            />
                        </div>
                    </div>

                    {/* Status */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">สถานะ</label>
                        <Select
                            value={filters.status || undefined}
                            onValueChange={(value) =>
                                onFiltersChange((prev) => ({
                                    ...prev,
                                    status: value === "all" ? "" : value,
                                }))
                            }
                        >
                            <SelectTrigger>
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
                    <div className="space-y-2">
                        <label className="text-sm font-medium">หมวดหมู่</label>
                        <Select
                            value={filters.category || undefined}
                            onValueChange={(value) =>
                                onFiltersChange((prev) => ({
                                    ...prev,
                                    category: value === "all" ? "" : value,
                                }))
                            }
                        >
                            <SelectTrigger>
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
                    <div className="space-y-2">
                        <label className="text-sm font-medium">ความสำคัญ</label>
                        <Select
                            value={filters.priority || undefined}
                            onValueChange={(value) =>
                                onFiltersChange((prev) => ({
                                    ...prev,
                                    priority: value === "all" ? "" : value,
                                }))
                            }
                        >
                            <SelectTrigger>
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

                    {/* Reset */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            รีเซ็ตตัวกรอง
                        </label>
                        <Button
                            variant="outline"
                            onClick={onReset}
                            className="w-full"
                        >
                            ล้างตัวกรอง
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
