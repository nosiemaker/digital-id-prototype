"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { AlertCircle, X, Search, HelpCircle, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * ICD11SearchInput — Multi-instance safe version
 *
 * Fix: ECT.Handler is a global singleton. Calling configure() inside each
 * component instance overwrites the callbacks for ALL instances. We now
 * configure ECT once globally and route selections to the correct React
 * component via an instance registry keyed by data-ctw-ino (iNo).
 */

// ─── Types ───────────────────────────────────────────────────────────────────

interface ICD11SearchInputProps {
  instanceId: string
  value?: string
  label?: string
  onSelect: (code: string, title: string) => void
  onClear?: () => void
  placeholder?: string
  error?: string
  disabled?: boolean
  className?: string
  fieldLabel?: string
  showHelp?: boolean
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ECT_CSS = "https://icdcdn.who.int/embeddedct/icd11ect-1.3.css"
const ECT_JS  = "https://icdcdn.who.int/embeddedct/icd11ect-1.3.js"

const API_URL =
  process.env.NEXT_PUBLIC_ICD11_API_URL ??
  "https://icd11restapi-developer-test.azurewebsites.net"

// ─── Global Singleton State ──────────────────────────────────────────────────

/**
 * Registry that maps each ECT instance identifier (iNo / data-ctw-ino)
 * to its React onSelect callback. The global ECT callback routes here.
 */
const instanceRegistry = new Map<string, (code: string, title: string) => void>()

let configurePromise: Promise<void> | null = null

function injectECTAssets(): Promise<void> {
  if (configurePromise) return configurePromise

  configurePromise = new Promise((resolve, reject) => {
    if (typeof document === "undefined") return resolve()

    // Custom styles to keep the popup on top and un-clipped by Dialogs
    const styleId = "icd11-custom-styles"
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style")
      style.id = styleId
      style.textContent = `
        .ctw-window {
          position: fixed !important;
          z-index: 99999 !important;
          background: white !important;
          border-radius: 12px !important;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25) !important;
          width: 90% !important;
          max-width: 900px !important;
          min-width: 320px !important;
          max-height: 80vh !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          overflow: hidden !important;
          color: #1a1a1a !important;
          pointer-events: auto !important;
          font-family: inherit !important;
        }
        
        /* Aggressive Clean UI: Hide all clutter */
        .ctw-window .ctw-results-header,
        .ctw-window .ctw-label,
        .ctw-window .ctw-results-count,
        .ctw-window .ctw-filter-container,
        .ctw-window .ctw-sort-container,
        .ctw-window .ctw-searching,
        .ctw-window .ctw-searching-text,
        .ctw-window .ctw-word-list,
        .ctw-window .ctw-word-item,
        .ctw-window b {
          display: none !important;
        }

        .ctw-window .ctw-embedded-explorer { display: block !important; height: 100% !important; }
        .ctw-window .ctw-results-container { height: 100% !important; overflow-y: auto !important; padding: 1rem !important; }
        
        /* Clean Item Styling */
        .ctw-window .ctw-entity-item { 
          padding: 12px 16px !important; 
          border-radius: 8px !important; 
          border: 1px solid transparent !important;
          margin-bottom: 4px !important;
        }
        .ctw-window .ctw-entity-item:hover { 
          background: #f1f5f9 !important; 
          border-color: #3b82f6 !important;
        }
        .ctw-window .ctw-entity-code {
          background: #3b82f6 !important;
          color: white !important;
          padding: 2px 8px !important;
          border-radius: 4px !important;
          font-weight: 700 !important;
        }
      `
      document.head.appendChild(style)
    }

    if (!document.querySelector(`link[href="${ECT_CSS}"]`)) {
      const link = document.createElement("link")
      link.rel  = "stylesheet"
      link.href = ECT_CSS
      document.head.appendChild(link)
    }

    if ((window as any).ECT) {
      configureGlobalECT()
      return resolve()
    }

    const script = document.createElement("script")
    script.src     = ECT_JS
    script.onload  = () => {
      configureGlobalECT()
      resolve()
    }
    script.onerror = () => reject(new Error("Failed to load ICD-11 ECT script"))
    document.body.appendChild(script)
  })

  return configurePromise
}

/**
 * Configure ECT exactly once. The selectedEntityFunction uses the registry
 * to route the selection to the correct React component instance.
 */
function configureGlobalECT() {
  const ECT = (window as any).ECT
  if (!ECT?.Handler || ECT.__reactConfigured) return
  ECT.__reactConfigured = true

  const settings = {
    apiServerUrl: API_URL,
    apiSecured: false,
    language: "en",
    autoBind: false,
    popupMode: true,
    popupHorizontalAlign: "center",
    popupVerticalAlign: "middle",
    searchByTitle: true,
    searchMode: "contains",
  }

  const callbacks = {
    selectedEntityFunction: (entity: any) => {
      // ECT returns iNo as the data-ctw-ino value. Convert to string for safety.
      const iNo = String(entity?.iNo ?? "")
      const callback = instanceRegistry.get(iNo)
      if (!callback) return

      const code  = entity?.code || entity?.uri?.split("/").pop() || ""
      const title = entity?.bestMatchText || entity?.selectedText || entity?.title || ""

      if (code && title) {
        callback(code, title)
        // Clear the correct instance's search box and close its popup
        ECT.Handler.clear(iNo)
      }
    },
  }

  ECT.Handler.configure(settings, callbacks)
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ICD11SearchInput({
  instanceId,
  value,
  label,
  onSelect,
  onClear,
  placeholder = "Search ICD-11 diagnosis…",
  error,
  disabled = false,
  className,
  fieldLabel = "ICD-11 Diagnosis Code",
  showHelp = true,
}: ICD11SearchInputProps) {
  const [ready, setReady]   = useState(false)
  const [isOpen, setIsOpen]  = useState(false)

  const wrapperRef = useRef<HTMLDivElement>(null)

  // ── Register / unregister this instance's callback ────────────────────────
  useEffect(() => {
    instanceRegistry.set(instanceId, onSelect)
    return () => { instanceRegistry.delete(instanceId) }
  }, [instanceId, onSelect])

  // ── Bind this instance to ECT ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    injectECTAssets().then(() => {
      if (cancelled) return
      const ECT = (window as any).ECT
      if (!ECT?.Handler) return

      try {
        ECT.Handler.bind(instanceId)
        setReady(true)
      } catch (err) {
        console.error(`[ICD11SearchInput-${instanceId}] Bind failed:`, err)
      }
    })

    return () => { cancelled = true }
  }, [instanceId])

  // ── Click-outside to close visual state ───────────────────────────────────
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      const inWrapper = wrapperRef.current?.contains(target)
      const inPopup   = !!document.querySelector(".ctw-window")?.contains(target)
      if (!inWrapper && !inPopup) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside, true)
    return () => document.removeEventListener("mousedown", handleClickOutside, true)
  }, [isOpen])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    const ECT = (window as any).ECT
    ECT?.Handler?.clear(instanceId)
    onClear?.()
  }, [instanceId, onClear])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={wrapperRef} className={cn("space-y-2", className)}>
      {/* Label row */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">{fieldLabel}</label>
        {showHelp && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs p-4 text-xs">
                <p className="font-semibold mb-1">ICD-11 Search</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Click the search box</li>
                  <li>Type a diagnosis name</li>
                  <li>Select the matching code from the popup</li>
                </ol>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Selected value display */}
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border px-4 py-3 bg-card border-border">
          <div className="flex flex-col flex-1 min-w-0">
            <span className="font-mono text-sm font-bold text-primary">{value}</span>
            <span className="text-sm text-foreground truncate">{label || value}</span>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-2 hover:bg-destructive/10 rounded-full"
            >
              <X className="h-4 w-4 text-destructive" />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            className={cn(
              "ctw-input flex h-12 w-full rounded-lg border bg-card px-4 py-3 text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              error ? "border-red-500" : "border-border",
              !ready && "opacity-50 cursor-not-allowed"
            )}
            autoComplete="off"
            data-ctw-ino={instanceId}
            placeholder={ready ? placeholder : "Loading ICD-11…"}
            disabled={disabled || !ready}
            onFocus={() => setIsOpen(true)}
          />

          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {isOpen
              ? <ChevronDown className="h-5 w-5 text-primary" />
              : <Search className="h-5 w-5 text-muted-foreground" />
            }
          </div>

          {/* ECT renders results here; CSS forces it to fixed positioning */}
          <div className="ctw-window" data-ctw-ino={instanceId} />
        </div>
      )}

      {error && (
        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  )
}