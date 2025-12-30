"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

interface SuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
    buttonText?: string;
    onButtonClick?: () => void;
}

export function SuccessModal({
    isOpen,
    onClose,
    title,
    description,
    buttonText = "ตกลง",
    onButtonClick,
}: SuccessModalProps) {
    const handleButtonClick = () => {
        if (onButtonClick) {
            onButtonClick();
        } else {
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-green-100 to-emerald-100 border border-green-200/50 shadow-inner">
                        <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                    <DialogTitle className="text-xl font-semibold text-gray-900">
                        {title}
                    </DialogTitle>
                    <DialogDescription className="text-base text-gray-600 mt-2">
                        {description}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex justify-center mt-6">
                    <Button onClick={handleButtonClick} className="px-8">
                        {buttonText}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
