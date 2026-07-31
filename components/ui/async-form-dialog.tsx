"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react"
import { X } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"

interface AsyncFormDialogContextValue {
  busy: boolean
  dirty: boolean
  requestClose: () => void
  restoreFocus: () => boolean
}

interface AsyncFormDialogProps {
  busy: boolean
  children: ReactNode
  dirty: boolean
  discardDescription?: string
  discardTitle?: string
  onClose: () => void
  onDiscard: () => void
  open: boolean
}

type AsyncFormDialogContentProps = Omit<
  ComponentProps<typeof DialogContent>,
  "showCloseButton"
>

const AsyncFormDialogContext =
  createContext<AsyncFormDialogContextValue | null>(null)

const FOCUSABLE_ELEMENT_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function AsyncFormDialog({
  busy,
  children,
  dirty,
  discardDescription = "ข้อมูลที่ยังไม่ได้ส่งจะถูกลบ หากต้องการกลับไปตรวจสอบให้เลือกแก้ไขต่อ",
  discardTitle = "ทิ้งข้อมูลที่กรอกไว้?",
  onClose,
  onDiscard,
  open,
}: AsyncFormDialogProps): ReactElement {
  const [discardConfirmationOpen, setDiscardConfirmationOpen] = useState(false)
  const restoreFocusElementRef = useRef<HTMLElement | null>(null)

  const discardAndClose = useCallback((): void => {
    setDiscardConfirmationOpen(false)
    onDiscard()
    onClose()
  }, [onClose, onDiscard])

  const requestClose = useCallback((): void => {
    if (busy) {
      return
    }

    if (dirty) {
      setDiscardConfirmationOpen(true)
      return
    }

    discardAndClose()
  }, [busy, dirty, discardAndClose])

  useEffect(() => {
    if (!open) {
      setDiscardConfirmationOpen(false)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      return
    }

    const rememberFocusTarget = (event: Event): void => {
      if (!(event.target instanceof Element)) {
        return
      }

      const focusTarget = event.target.closest<HTMLElement>(
        FOCUSABLE_ELEMENT_SELECTOR
      )
      if (focusTarget && !focusTarget.matches(":disabled")) {
        restoreFocusElementRef.current = focusTarget
      }
    }

    document.addEventListener("click", rememberFocusTarget, true)
    document.addEventListener("focusin", rememberFocusTarget, true)
    return () => {
      document.removeEventListener("click", rememberFocusTarget, true)
      document.removeEventListener("focusin", rememberFocusTarget, true)
    }
  }, [open])

  const restoreFocus = useCallback((): boolean => {
    const restoreTarget = restoreFocusElementRef.current
    if (!restoreTarget?.isConnected) {
      return false
    }

    restoreTarget.focus()
    return true
  }, [])

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      requestClose()
    }
  }

  return (
    <AsyncFormDialogContext.Provider
      value={{ busy, dirty, requestClose, restoreFocus }}
    >
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {children}
      </Dialog>

      <AlertDialog
        open={open && discardConfirmationOpen}
        onOpenChange={setDiscardConfirmationOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{discardTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {discardDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>แก้ไขต่อ</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={discardAndClose}
            >
              ทิ้งข้อมูล
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AsyncFormDialogContext.Provider>
  )
}

export function AsyncFormDialogContent({
  onCloseAutoFocus,
  onEscapeKeyDown,
  onInteractOutside,
  ...props
}: AsyncFormDialogContentProps): ReactElement {
  const { busy, dirty, requestClose, restoreFocus } =
    useAsyncFormDialogContext()
  const shouldGuardDismiss = busy || dirty

  return (
    <DialogContent
      showCloseButton={false}
      onCloseAutoFocus={(event) => {
        onCloseAutoFocus?.(event)
        if (!event.defaultPrevented && restoreFocus()) {
          event.preventDefault()
        }
      }}
      onEscapeKeyDown={(event) => {
        onEscapeKeyDown?.(event)
        if (!event.defaultPrevented && shouldGuardDismiss) {
          event.preventDefault()
          requestClose()
        }
      }}
      onInteractOutside={(event) => {
        onInteractOutside?.(event)
        if (!event.defaultPrevented && shouldGuardDismiss) {
          event.preventDefault()
          requestClose()
        }
      }}
      {...props}
    />
  )
}

export function AsyncFormDialogClose({
  "aria-label": ariaLabel,
  children,
  disabled,
  onClick,
  type = "button",
  ...props
}: ComponentProps<typeof Button>): ReactElement {
  const { busy, requestClose } = useAsyncFormDialogContext()
  const content = children ?? <X aria-hidden="true" />

  return (
    <Button
      type={type}
      aria-label={ariaLabel ?? (children ? undefined : "ปิดแบบฟอร์ม")}
      disabled={busy || disabled}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) {
          requestClose()
        }
      }}
      {...props}
    >
      {content}
    </Button>
  )
}

function useAsyncFormDialogContext(): AsyncFormDialogContextValue {
  const context = useContext(AsyncFormDialogContext)

  if (!context) {
    throw new Error(
      "AsyncFormDialog components must be used within AsyncFormDialog"
    )
  }

  return context
}
