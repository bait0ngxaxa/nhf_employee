import { useState, type ReactElement } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import {
  AsyncFormDialog,
  AsyncFormDialogClose,
  AsyncFormDialogContent,
} from "./async-form-dialog"

describe("AsyncFormDialog", () => {
  it("closes a clean form without opening discard confirmation", () => {
    const onDiscard = vi.fn()
    const onClose = vi.fn()

    render(
      <AsyncFormDialog
        open
        busy={false}
        dirty={false}
        onDiscard={onDiscard}
        onClose={onClose}
      >
        <AsyncFormDialogContent>
          <AsyncFormDialogClose>ปิด</AsyncFormDialogClose>
        </AsyncFormDialogContent>
      </AsyncFormDialog>,
    )

    fireEvent.click(screen.getByRole("button", { name: "ปิด" }))

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(onDiscard).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("opens discard confirmation for a dirty form", () => {
    renderDialog({ dirty: true })

    fireEvent.click(screen.getByRole("button", { name: "ปิด" }))

    expect(
      screen.getByRole("alertdialog", { name: "ทิ้งข้อมูลที่กรอกไว้?" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("closes only the confirmation when continuing to edit", () => {
    renderDialog({ dirty: true })

    fireEvent.click(screen.getByRole("button", { name: "ปิด" }))
    fireEvent.click(screen.getByRole("button", { name: "แก้ไขต่อ" }))

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByLabelText("ข้อมูล")).toHaveValue("ร่างเดิม")
  })

  it("calls onDiscard before closing after discard confirmation", () => {
    const calls: string[] = []

    render(
      <AsyncFormDialog
        open
        busy={false}
        dirty
        onDiscard={() => calls.push("discard")}
        onClose={() => calls.push("close")}
      >
        <AsyncFormDialogContent>
          <AsyncFormDialogClose>ปิด</AsyncFormDialogClose>
        </AsyncFormDialogContent>
      </AsyncFormDialog>,
    )

    fireEvent.click(screen.getByRole("button", { name: "ปิด" }))
    fireEvent.click(screen.getByRole("button", { name: "ทิ้งข้อมูล" }))

    expect(calls).toEqual(["discard", "close"])
  })

  it("does not dismiss a busy form", () => {
    const onClose = vi.fn()

    render(
      <AsyncFormDialog
        open
        busy
        dirty
        onDiscard={vi.fn()}
        onClose={onClose}
      >
        <AsyncFormDialogContent>
          <AsyncFormDialogClose>ปิด</AsyncFormDialogClose>
        </AsyncFormDialogContent>
      </AsyncFormDialog>,
    )

    expect(screen.getByRole("button", { name: "ปิด" })).toBeDisabled()
    fireEvent.keyDown(document, { key: "Escape" })

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("destroys confirmation state when the parent closes and starts the next session clean", () => {
    const view = render(<AsyncFormDialogHarness />)

    fireEvent.click(screen.getByRole("button", { name: "เปิดฟอร์ม" }))
    fireEvent.change(screen.getByLabelText("ข้อมูล"), {
      target: { value: "ร่างใหม่" },
    })
    fireEvent.click(screen.getByRole("button", { name: "ปิด" }))
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "ปิดจากภายนอก" }))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()

    view.rerender(<AsyncFormDialogHarness />)
    fireEvent.click(screen.getByRole("button", { name: "เปิดฟอร์ม" }))

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("does not retain discard confirmation across close and reopen", () => {
    const view = render(<AsyncFormDialogHarness />)

    fireEvent.click(screen.getByRole("button", { name: "เปิดฟอร์ม" }))
    fireEvent.change(screen.getByLabelText("ข้อมูล"), {
      target: { value: "ร่างใหม่" },
    })
    fireEvent.click(screen.getByRole("button", { name: "ปิด" }))
    fireEvent.click(screen.getByRole("button", { name: "ปิดจากภายนอก" }))

    view.rerender(<AsyncFormDialogHarness />)
    fireEvent.click(screen.getByRole("button", { name: "เปิดฟอร์ม" }))

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("restores focus to the invoking element after a clean close", async () => {
    render(<AsyncFormDialogHarness />)
    const trigger = screen.getByRole("button", { name: "เปิดฟอร์ม" })
    trigger.focus()

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole("button", { name: "ปิด" }))

    await waitFor(() => expect(trigger).toHaveFocus())
  })
})

function renderDialog({ dirty }: { dirty: boolean }): void {
  render(
    <AsyncFormDialog
      open
      busy={false}
      dirty={dirty}
      onDiscard={vi.fn()}
      onClose={vi.fn()}
    >
      <AsyncFormDialogContent>
        <label>
          ข้อมูล
          <input defaultValue="ร่างเดิม" />
        </label>
        <AsyncFormDialogClose>ปิด</AsyncFormDialogClose>
      </AsyncFormDialogContent>
    </AsyncFormDialog>,
  )
}

function AsyncFormDialogHarness(): ReactElement {
  const [open, setOpen] = useState(false)
  const [dirty, setDirty] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        เปิดฟอร์ม
      </button>
      <button type="button" onClick={() => setOpen(false)}>
        ปิดจากภายนอก
      </button>
      <AsyncFormDialog
        open={open}
        busy={false}
        dirty={dirty}
        onDiscard={() => setDirty(false)}
        onClose={() => setOpen(false)}
      >
        <AsyncFormDialogContent>
          <label>
            ข้อมูล
            <input
              defaultValue="ร่างเดิม"
              onChange={() => setDirty(true)}
            />
          </label>
          <AsyncFormDialogClose>ปิด</AsyncFormDialogClose>
        </AsyncFormDialogContent>
      </AsyncFormDialog>
    </>
  )
}
