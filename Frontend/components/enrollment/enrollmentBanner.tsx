"use client"

/**
 * EnrollmentBanner
 *
 * Shown at the top of the wallet page when the citizen hasn't completed
 * identity registration. Two variants:
 *
 *   NOT_STARTED  →  amber warning — "Complete your registration"
 *   PENDING      →  blue info     — "Your documents are under review"
 *
 * The banner is dismissible for the current session (stored in sessionStorage
 * so it reappears on next login, keeping the nudge persistent but not annoying).
 */

import Link from "next/link"
import { useState, useEffect } from "react"
import { AlertTriangle, Clock, ArrowRight, X } from "lucide-react"
import type { EnrollmentState } from "@/hooks/useMe"

interface Props {
  state: EnrollmentState
}

const DISMISS_KEY = "zdid_banner_dismissed"

export function EnrollmentBanner({ state }: Props) {
  const [dismissed, setDismissed] = useState(false)

  // Re-show banner on every new login session
  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1")
  }, [])

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1")
    setDismissed(true)
  }

  if (dismissed || (state !== "NOT_STARTED" && state !== "PENDING")) return null

  const isNotStarted = state === "NOT_STARTED"

  return (
    <div
      className={[
        "relative w-full rounded-xl border px-5 py-4 text-sm",
        isNotStarted
          ? "border-amber-500/40 bg-amber-500/8 text-amber-200"
          : "border-blue-500/40 bg-blue-500/8 text-blue-200",
      ].join(" ")}
      role="alert"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={[
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            isNotStarted ? "bg-amber-500/15" : "bg-blue-500/15",
          ].join(" ")}
        >
          {isNotStarted ? (
            <AlertTriangle className={`h-4 w-4 ${isNotStarted ? "text-amber-400" : "text-blue-400"}`} />
          ) : (
            <Clock className="h-4 w-4 text-blue-400" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`font-semibold ${isNotStarted ? "text-amber-300" : "text-blue-300"}`}>
            {isNotStarted
              ? "Complete your Digital ID registration"
              : "Identity documents under review"}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed opacity-80">
            {isNotStarted
              ? "Your account is active but your Digital ID hasn't been issued yet. Submit your NRC and Your photo to begin the verification process."
              : "A Registration Officer is reviewing your submitted documents. You'll be notified once your DIN is assigned."}
          </p>

          {/* CTA — only for NOT_STARTED */}
          {isNotStarted && (
            <Link
              href="/registration/identity"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-semibold text-black hover:bg-amber-400 transition-colors"
            >
              Complete registration <ArrowRight className="h-3 w-3" />
            </Link>
          )}

          {/* Status pill — for PENDING */}
          {!isNotStarted && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 px-3 py-1 text-[11px] font-medium text-blue-300">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
              Pending RO review
            </div>
          )}
        </div>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="shrink-0 rounded-md p-1 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}