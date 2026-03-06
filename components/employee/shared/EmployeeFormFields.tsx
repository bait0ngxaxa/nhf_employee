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
    onChange: (value: string) => void;
}

function FormField({
    id,
    label,
    type = "text",
    placeholder,
    value,
    error,
    onChange,
}: FormFieldProps) {
    return (
        <div className="grid gap-3">
            <Label htmlFor={id} className={error ? "text-red-500" : ""}>
                {label}
            </Label>
            <Input
                id={id}
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={
                    error ? "border-red-500 focus-visible:ring-red-500" : ""
                }
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
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
            <div className="grid grid-cols-2 gap-3">
                <FormField
                    id="firstName"
                    label="ชื่อ"
                    placeholder="ชื่อจริง"
                    value={formData.firstName}
                    error={fieldErrors.firstName}
                    onChange={(v) => onFieldChange("firstName", v)}
                />
                <FormField
                    id="lastName"
                    label="นามสกุล"
                    placeholder="นามสกุล"
                    value={formData.lastName}
                    error={fieldErrors.lastName}
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
                onChange={(v) => onFieldChange("phone", v)}
            />

            {/* Position */}
            <FormField
                id="position"
                label="ตำแหน่ง"
                placeholder="เช่น ผู้จัดการ, อาจารย์, นักวิชาการ"
                value={formData.position}
                error={fieldErrors.position}
                onChange={(v) => onFieldChange("position", v)}
            />

            {/* Affiliation */}
            <FormField
                id="affiliation"
                label="สังกัด"
                placeholder="เช่น มสช. สพบ. หรืออื่นๆ"
                value={formData.affiliation ?? ""}
                error={fieldErrors.affiliation}
                onChange={(v) => onFieldChange("affiliation", v)}
            />

            {/* Department Select */}
            <div className="grid gap-3">
                <Label
                    htmlFor="departmentId"
                    className={fieldErrors.departmentId ? "text-red-500" : ""}
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
                        className={
                            fieldErrors.departmentId
                                ? "border-red-500 focus:ring-red-500"
                                : ""
                        }
                    >
                        <SelectValue placeholder="เลือกแผนก" />
                    </SelectTrigger>
                    <SelectContent>
                        {departments.map((dept) => (
                            <SelectItem
                                key={dept.id}
                                value={dept.id.toString()}
                            >
                                {dept.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {fieldErrors.departmentId && (
                    <p className="text-xs text-red-500">
                        {fieldErrors.departmentId}
                    </p>
                )}
            </div>
        </>
    );
}
