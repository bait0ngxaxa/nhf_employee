import { useState, type ChangeEvent } from "react";
import { apiPatch } from "@/lib/client/api-client";
import { toast } from "sonner";
import { isSharedDriveOption } from "../../../domain/email-request/constants";
import { updateAccessRequirementsSchema, type AccessRequirements } from "../../../domain/email-request/access-requirements";
import type { EmailRequest } from "../../../domain/email-request/contracts";

export function useEmailRequestAccessEditor(initial: EmailRequest, onSaved: () => void): {
    request: EmailRequest; values: AccessRequirements; editing: boolean; saving: boolean;
    error: string | null; conflict: boolean; setEditing: (value: boolean) => void;
    handleChange: (event: ChangeEvent<HTMLInputElement>) => void; save: () => Promise<void>;
} {
    const [request, setRequest] = useState(initial);
    const [values, setValues] = useState<AccessRequirements>({ documentSystemDecision: initial.documentSystemDecision,
        sharedDriveDecision: initial.sharedDriveDecision, sharedDriveAccess: initial.sharedDriveAccess });
    const [editing, setEditingState] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [conflict, setConflict] = useState(false);
    function setEditing(value: boolean): void {
        setValues({ documentSystemDecision: request.documentSystemDecision, sharedDriveDecision: request.sharedDriveDecision,
            sharedDriveAccess: request.sharedDriveAccess });
        setError(null);
        setConflict(false);
        setEditingState(value);
    }
    function handleChange(event: ChangeEvent<HTMLInputElement>): void {
        const { name, value, checked } = event.target;
        setValues((previous) => {
            if (name === "sharedDriveAccess" && isSharedDriveOption(value)) {
                return { ...previous, sharedDriveAccess: checked ? [...previous.sharedDriveAccess, value]
                    : previous.sharedDriveAccess.filter((drive) => drive !== value) };
            }
            if ((name === "documentSystemDecision" || name === "sharedDriveDecision")
                && (value === "UNDECIDED" || value === "NOT_REQUIRED" || value === "REQUIRED")) {
                return { ...previous, [name]: value,
                    sharedDriveAccess: name === "sharedDriveDecision" && value !== "REQUIRED" ? [] : previous.sharedDriveAccess };
            }
            return previous;
        });
        setError(null);
    }
    async function save(): Promise<void> {
        if (saving || conflict) return;
        const parsed = updateAccessRequirementsSchema.safeParse({ ...values, expectedAccessVersion: request.accessVersion });
        if (!parsed.success) { setError(parsed.error.issues.map((issue) => issue.message).join(", ")); return; }
        setSaving(true);
        setError(null);
        try {
            const result = await apiPatch<{ data: EmailRequest; changed: boolean }>(`/api/email-request/${request.id}/access-requirements`, parsed.data);
            if (!result.success) {
                setError(result.errorThai);
                setConflict(result.status === 409);
                return;
            }
            setRequest({ ...request, ...result.data.data });
            setEditingState(false);
            toast.success(result.data.changed ? "บันทึกสิทธิ์และส่งการแจ้งเตือนให้ทีม IT แล้ว" : "สิทธิ์การใช้งานไม่มีการเปลี่ยนแปลง");
            onSaved();
        } catch {
            setError("ไม่สามารถเชื่อมต่อได้ กรุณาลองบันทึกอีกครั้ง");
        } finally { setSaving(false); }
    }
    return { request, values, editing, saving, error, conflict, setEditing, handleChange, save };
}
