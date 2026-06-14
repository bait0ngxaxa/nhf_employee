import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { type EmployeeFormFieldsProps } from "./types";

interface FormFieldProps {
    id: string;
    label: string;
    type?: string;
    placeholder: string;
    value: string;
    error?: string;
    autoComplete?: string;
    maxLength?: number;
    inputMode?: "email" | "tel" | "text";
    onChange: (value: string) => void;
}

function FormField({
    id,
    label,
    type = "text",
    placeholder,
    value,
    error,
    autoComplete,
    maxLength,
    inputMode,
    onChange,
}: FormFieldProps) {
    const errorId = `${id}-error`;

    return (
        <div className="grid min-w-0 gap-3">
            <Label
                htmlFor={id}
                className={error ? "text-red-700 [overflow-wrap:anywhere]" : "[overflow-wrap:anywhere]"}
            >
                {label}
            </Label>
            <Input
                id={id}
                type={type}
                placeholder={placeholder}
                value={value}
                autoComplete={autoComplete}
                maxLength={maxLength}
                inputMode={inputMode}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                onChange={(e) => onChange(e.target.value)}
                className={
                    error
                        ? "border-red-500 focus-visible:ring-red-500"
                        : ""
                }
            />
            {error && (
                <p id={errorId} className="text-xs leading-5 text-red-700 [overflow-wrap:anywhere]">
                    {error}
                </p>
            )}
        </div>
    );
}

export function EmployeeFormFields({
    formData,
    fieldErrors,
    departments,
    onFieldChange,
}: EmployeeFormFieldsProps) {
    return (
        <>
            {/* Name Row */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                    id="firstName"
                    label="ชื่อ"
                    placeholder="ชื่อจริง"
                    value={formData.firstName}
                    error={fieldErrors.firstName}
                    autoComplete="given-name"
                    maxLength={80}
                    onChange={(v) => onFieldChange("firstName", v)}
                />
                <FormField
                    id="lastName"
                    label="นามสกุล"
                    placeholder="นามสกุล"
                    value={formData.lastName}
                    error={fieldErrors.lastName}
                    autoComplete="family-name"
                    maxLength={80}
                    onChange={(v) => onFieldChange("lastName", v)}
                />
            </div>

            {/* Nickname */}
            <FormField
                id="nickname"
                label="ชื่อเล่น (ไม่บังคับ)"
                placeholder="ชื่อเล่นที่ใช้ในชีวิตประจำวัน"
                value={formData.nickname ?? ""}
                error={fieldErrors.nickname}
                autoComplete="nickname"
                maxLength={80}
                onChange={(v) => onFieldChange("nickname", v)}
            />

            {/* Email */}
            <FormField
                id="email"
                label="อีเมล"
                type="email"
                placeholder="example@company.com"
                value={formData.email}
                error={fieldErrors.email}
                autoComplete="email"
                inputMode="email"
                maxLength={254}
                onChange={(v) => onFieldChange("email", v)}
            />

            {/* Phone */}
            <FormField
                id="phone"
                label="เบอร์โทรศัพท์"
                type="tel"
                placeholder="081-234-5678"
                value={formData.phone ?? ""}
                error={fieldErrors.phone}
                autoComplete="tel"
                inputMode="tel"
                maxLength={30}
                onChange={(v) => onFieldChange("phone", v)}
            />

            {/* Position */}
            <FormField
                id="position"
                label="ตำแหน่ง"
                placeholder="เช่น ผู้จัดการ, อาจารย์, นักวิชาการ"
                value={formData.position}
                error={fieldErrors.position}
                autoComplete="organization-title"
                maxLength={120}
                onChange={(v) => onFieldChange("position", v)}
            />

            {/* Affiliation */}
            <FormField
                id="affiliation"
                label="สังกัด"
                placeholder="เช่น มสช. สพบ. หรืออื่นๆ"
                value={formData.affiliation ?? ""}
                error={fieldErrors.affiliation}
                autoComplete="organization"
                maxLength={120}
                onChange={(v) => onFieldChange("affiliation", v)}
            />

            {/* Department Select */}
            <div className="grid min-w-0 gap-3">
                <Label
                    htmlFor="departmentId"
                    className={fieldErrors.departmentId ? "text-red-700" : ""}
                >
                    แผนก
                </Label>
                <Select
                    value={String(formData.departmentId)}
                    onValueChange={(value) =>
                        onFieldChange("departmentId", value)
                    }
                >
                    <SelectTrigger
                        id="departmentId"
                        aria-invalid={Boolean(fieldErrors.departmentId)}
                        aria-describedby={
                            fieldErrors.departmentId
                                ? "departmentId-error"
                                : undefined
                        }
                        className={
                            fieldErrors.departmentId
                                ? "border-red-500 focus:ring-red-500"
                                : ""
                        }
                    >
                        <SelectValue placeholder="เลือกแผนก" />
                    </SelectTrigger>
                    <SelectContent>
                        {departments.length > 0 ? (
                            departments.map((dept) => (
                                <SelectItem
                                    key={dept.id}
                                    value={dept.id.toString()}
                                    className="max-w-[min(24rem,calc(100vw-3rem))] [overflow-wrap:anywhere]"
                                >
                                    {dept.name}
                                </SelectItem>
                            ))
                        ) : (
                            <SelectItem value="__empty" disabled>
                                ไม่พบข้อมูลแผนก
                            </SelectItem>
                        )}
                    </SelectContent>
                </Select>
                {fieldErrors.departmentId && (
                    <p
                        id="departmentId-error"
                        className="text-xs leading-5 text-red-700 [overflow-wrap:anywhere]"
                    >
                        {fieldErrors.departmentId}
                    </p>
                )}
            </div>
        </>
    );
}
