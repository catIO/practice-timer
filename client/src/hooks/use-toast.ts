import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type Toast = Omit<ToasterToast, "id">

interface ToastContextType {
  toasts: ToasterToast[]
  addToast: (toast: Toast) => string
  dismissToast: (id?: string) => void
}

const ToastContext = React.createContext<ToastContextType>({
  toasts: [],
  addToast: () => "",
  dismissToast: () => {},
})

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToasterToast[]>([])

  const addToast = React.useCallback((toast: Toast) => {
    const id = genId()
    setToasts((prev) => {
      const newToasts = [{ ...toast, id, open: true }, ...prev].slice(0, TOAST_LIMIT)
      return newToasts
    })
    return id
  }, [])

  const dismissToast = React.useCallback((id?: string) => {
    setToasts((prev) => {
      if (!id) return []
      return prev.map((toast) =>
        toast.id === id ? { ...toast, open: false } : toast
      )
    })
  }, [])

  const value = React.useMemo(
    () => ({
      toasts,
      addToast,
      dismissToast,
    }),
    [toasts, addToast, dismissToast]
  )

  return React.createElement(ToastContext.Provider, { value }, children)
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }

  return {
    ...context,
    toast: context.addToast,
  }
}
