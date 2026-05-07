"use client"

import { Capacitor } from "@capacitor/core"
import { Filesystem, Directory } from "@capacitor/filesystem"
import { Share } from "@capacitor/share"
import { useState, useEffect, useCallback, useRef } from "react"
import { FileText, Download, X, Loader2, AlertCircle, Eye, ChevronDown } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// ============================================================================
// MULTIPART PDF PARSER
// ============================================================================

const isNative = typeof window !== "undefined" && Capacitor.isNativePlatform()

function parseMultipart(buffer: ArrayBuffer, boundary: string): Map<string, Uint8Array> {
  const bytes = new Uint8Array(buffer)
  const decoder = new TextDecoder()
  const parts = new Map<string, Uint8Array>()

  const boundaryBytes = new TextEncoder().encode(`--${boundary}`)
  const positions: number[] = []

  outer: for (let i = 0; i < bytes.length - boundaryBytes.length; i++) {
    for (let j = 0; j < boundaryBytes.length; j++) {
      if (bytes[i + j] !== boundaryBytes[j]) continue outer
    }
    positions.push(i)
  }

  for (let p = 0; p < positions.length - 1; p++) {
    const start = positions[p] + boundaryBytes.length + 2
    const end = positions[p + 1] - 2

    const chunk = bytes.slice(start, end)
    const chunkText = decoder.decode(chunk)
    const headerBodySplit = chunkText.indexOf('\r\n\r\n')
    if (headerBodySplit === -1) continue

    const headers = chunkText.slice(0, headerBodySplit)
    const bodyStart = headerBodySplit + 4

    const nameMatch = headers.match(/name="([^"]+)"/)
    if (!nameMatch) continue

    const name = nameMatch[1]
    const body = chunk.slice(bodyStart)
    parts.set(name, body)
  }

  return parts
}

function pdfToUrl(uint8Array: Uint8Array): string {
  const buffer = uint8Array.buffer.slice(0, uint8Array.byteLength) as ArrayBuffer
  const blob = new Blob([buffer], { type: 'application/pdf' })
  return URL.createObjectURL(blob)
}

// ============================================================================
// TYPES
// ============================================================================

export interface DocumentPart {
  name: string
  label: string
  filename: string
}

export interface StreamingEndpoint {
  url: string | ((id: number) => string)
  method: "GET"
  parts: DocumentPart[]
  boundary?: string
  isSinglePdf?: boolean
  requiredStatus?: string
  accessRoles: string[]
}

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')

export const BIRTH_REVIEW_ENDPOINT: StreamingEndpoint = {
  url: (id: number) => `${API_BASE}/births/${id}/review`,
  method: "GET",
  parts: [
    { name: "notice_of_birth", label: "Notice of Birth (Form VIII)", filename: "notice_of_birth.pdf" },
    { name: "record_of_birth", label: "Record of Birth (M.F.2)", filename: "record_of_birth.pdf" },
  ],
  boundary: "birth-review-boundary",
  accessRoles: ["REGISTRAR"],
}

export const BIRTH_CERTIFICATE_ENDPOINT: StreamingEndpoint = {
  url: (id: number) => `${API_BASE}/births/${id}/view/certificate`,
  method: "GET",
  parts: [{ name: "birth_certificate", label: "Birth Certificate", filename: "birth_certificate.pdf" }],
  isSinglePdf: true,
  requiredStatus: "APPROVED",
  accessRoles: ["REGISTRAR", "CITIZEN"],
}

export const BIRTH_FULL_PACK_ENDPOINT: StreamingEndpoint = {
  url: (id: number) => `${API_BASE}/births/${id}/review/full_pack`,
  method: "GET",
  parts: [
    { name: "birth_certificate", label: "Birth Certificate", filename: "birth_certificate.pdf" },
    { name: "notice_of_birth", label: "Notice of Birth (Form VIII)", filename: "notice_of_birth.pdf" },
    { name: "record_of_birth", label: "Record of Birth (M.F.2)", filename: "record_of_birth.pdf" },
  ],
  boundary: "birth-full-pack-boundary",
  requiredStatus: "APPROVED",
  accessRoles: ["REGISTRAR", "HEALTH_WORKER"],
}

export const DEATH_REVIEW_ENDPOINT: StreamingEndpoint = {
  url: (id: number) => `${API_BASE}/deaths/${id}/view`,
  method: "GET",
  parts: [
    { name: "mccd", label: "Medical Certificate of Cause of Death", filename: "mccd.pdf" },
    { name: "notice_of_death", label: "Notice of Death (DNRPC Form)", filename: "notice_of_death.pdf" },
  ],
  boundary: "death-review-boundary",
  accessRoles: ["REGISTRAR"],
}

export const DEATH_CERTIFICATES_ENDPOINT: StreamingEndpoint = {
  url: (id: number) => `${API_BASE}/deaths/${id}/view/certificates`,
  method: "GET",
  parts: [
    { name: "death_certificate", label: "Death Certificate", filename: "death_certificate.pdf" },
    { name: "burial_permit", label: "Burial Permit (Form XI)", filename: "burial_permit.pdf" },
  ],
  boundary: "death-certificates-boundary",
  requiredStatus: "APPROVED",
  accessRoles: ["REGISTRAR", "CITIZEN"],
}

export const DEATH_FULL_PACK_ENDPOINT: StreamingEndpoint = {
  url: (id: number) => `${API_BASE}/deaths/${id}/review/full_pack`,
  method: "GET",
  parts: [
    { name: "death_certificate", label: "Death Certificate", filename: "death_certificate.pdf" },
    { name: "burial_permit", label: "Burial Permit (Form XI)", filename: "burial_permit.pdf" },
    { name: "mccd", label: "Medical Certificate of Cause of Death", filename: "mccd.pdf" },
    { name: "notice_of_death", label: "Notice of Death (DNRPC Form)", filename: "notice_of_death.pdf" },
  ],
  boundary: "death-full-pack-boundary",
  requiredStatus: "APPROVED",
  accessRoles: ["REGISTRAR", "HEALTH_WORKER"],
}

// ============================================================================
// HOOK: useDocumentStream
// ============================================================================

export function useDocumentStream() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [documents, setDocuments] = useState<Map<string, string>>(new Map())
  const [activeDoc, setActiveDoc] = useState<string | null>(null)
  const documentsRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    documentsRef.current = documents
  }, [documents])

  const fetchDocuments = useCallback(async (
    endpoint: StreamingEndpoint,
    recordId: number,
    token: string
  ) => {
    setLoading(true)
    setError(null)
    setDocuments(new Map())
    setActiveDoc(null)

    try {
      const url = typeof endpoint.url === 'function' ? endpoint.url(recordId) : endpoint.url
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
        throw new Error(err.detail || err.error || `Request failed with status ${res.status}`)
      }

      const newDocs = new Map<string, string>()

      if (endpoint.isSinglePdf) {
        const buffer = await res.arrayBuffer()
        const url = pdfToUrl(new Uint8Array(buffer))
        newDocs.set(endpoint.parts[0].name, url)
        setActiveDoc(endpoint.parts[0].name)
      } else {
        const contentType = res.headers.get('Content-Type') || ''
        const boundaryMatch = contentType.match(/boundary=(.+)/)
        if (!boundaryMatch) {
          throw new Error('No multipart boundary in response. Is this a streaming endpoint?')
        }
        const boundary = boundaryMatch[1]
        const buffer = await res.arrayBuffer()
        const parts = parseMultipart(buffer, boundary)

        for (const part of endpoint.parts) {
          const data = parts.get(part.name)
          if (data) {
            const url = pdfToUrl(data)
            newDocs.set(part.name, url)
          }
        }

        const firstAvailable = endpoint.parts.find(p => newDocs.has(p.name))
        if (firstAvailable) setActiveDoc(firstAvailable.name)
      }

      setDocuments(newDocs)

      const missing = endpoint.parts.filter(p => !newDocs.has(p.name)).map(p => p.label)
      if (missing.length > 0) {
        console.warn('Missing document parts:', missing)
      }

      return newDocs
    } catch (e: any) {
      const msg = e.message || 'Failed to load documents'
      setError(msg)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const cleanup = useCallback(() => {
    documentsRef.current.forEach((url) => URL.revokeObjectURL(url))
    setDocuments(new Map())
    setActiveDoc(null)
    setError(null)
  }, [])

  const downloadDocument = useCallback(async (part: DocumentPart) => {
    const url = documentsRef.current.get(part.name)
    if (!url) return

    if(isNative) {
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error("Failed to fetch PDF")
        const blob = await res.blob()

        const result = await Filesystem.writeFile({
            path: part.filename,
            data: blob,
            directory: Directory.Documents,
        })

        await Share.share({
            url: result.uri,
            title: part.label,
            dialogTitle: "View or Save Document",
        })
      } catch (err: any) {
        console.error("Native document open failed:", err)
        setError(err?.message || "Unable to open document. Please check storage permissions.")
      }
    }
    const a = document.createElement('a')
    a.href = url
    a.download = part.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [])

  const downloadAll = useCallback((parts: DocumentPart[]) => {
    parts.forEach((part, i) => {
      setTimeout(() => downloadDocument(part), i * 300)
    })
  }, [downloadDocument])

  return {
    loading,
    error,
    documents,
    activeDoc,
    setActiveDoc,
    fetchDocuments,
    cleanup,
    downloadDocument,
    downloadAll,
  }
}

// ============================================================================
// COMPONENT: DocumentViewer (Responsive Full-Screen Overlay)
// ============================================================================

interface DocumentViewerProps {
  onClose: () => void
  endpoint: StreamingEndpoint
  recordId: number | null
  recordName?: string
  token: string
  status?: string
}

export function DocumentViewer({
  onClose,
  endpoint,
  recordId,
  recordName,
  token,
  status,
}: DocumentViewerProps) {
  const {
    loading,
    error,
    documents,
    activeDoc,
    setActiveDoc,
    fetchDocuments,
    cleanup,
    downloadDocument,
    downloadAll,
  } = useDocumentStream()

  useEffect(() => {
    if (recordId) {
      fetchDocuments(endpoint, recordId, token)
    }
    return () => cleanup()
  }, [recordId, endpoint, token, fetchDocuments, cleanup])

  const activePart = endpoint.parts.find(p => p.name === activeDoc)
  const availableParts = endpoint.parts.filter(p => documents.has(p.name))
  const missingParts = endpoint.parts.filter(p => !documents.has(p.name))
  // Shorten label for tabs on mobile
  const shortLabel = (label: string) => label.split('(')[0].trim()

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background overflow-hidden">

      {/* ── Header ── */}
      <header className="px-3 sm:px-6 py-3 sm:py-4 border-b border-border bg-muted/20 shrink-0">
        <div className="flex items-center justify-between gap-2">

          {/* Title + badge */}
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
            <div className="min-w-0">
              {/* MOBILE: truncate long names */}
              <h2 className="text-sm sm:text-lg font-semibold truncate leading-tight">
                {recordName || "Document Viewer"}
              </h2>
              {status && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] sm:text-xs mt-0.5",
                    status === "APPROVED" && "border-green-500/30 bg-green-500/10 text-green-500",
                    status === "PENDING" && "border-yellow-500/30 bg-yellow-500/10 text-yellow-500",
                    status === "REJECTED" && "border-red-500/30 bg-red-500/10 text-red-500",
                  )}
                >
                  {status}
                </Badge>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {availableParts.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadAll(endpoint.parts)}
                className="h-8 text-xs sm:text-sm px-2 sm:px-3"
              >
                <Download className="h-3.5 w-3.5 sm:mr-1.5" />
                {/* MOBILE: icon-only; SM+: label */}
                <span className="hidden sm:inline">Download All</span>
              </Button>
            )}
            {/* MOBILE: download active doc individually */}
            {activePart && availableParts.length === 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadDocument(activePart)}
                className="h-8 px-2 sm:hidden"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* ── Body: sidebar (desktop) / tab bar (mobile) + viewer ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── DESKTOP SIDEBAR (hidden on mobile) ── */}
        <div className="hidden sm:flex w-60 lg:w-64 border-r border-border bg-muted/10 flex-col shrink-0">
          <div className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Documents ({availableParts.length}/{endpoint.parts.length})
          </div>
          <div className="flex-1 overflow-y-auto">
            {endpoint.parts.map((part) => {
              const isAvailable = documents.has(part.name)
              const isActive = activeDoc === part.name
              return (
                <button
                  key={part.name}
                  onClick={() => isAvailable && setActiveDoc(part.name)}
                  disabled={!isAvailable || loading}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-border transition-colors flex items-center gap-2",
                    isActive
                      ? "bg-primary/10 border-l-2 border-l-primary"
                      : "border-l-2 border-l-transparent hover:bg-muted/30",
                    !isAvailable && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <FileText
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-medium truncate",
                        isActive ? "text-primary" : "text-foreground"
                      )}
                    >
                      {part.label}
                    </p>
                    {!isAvailable && (
                      <p className="text-xs text-muted-foreground">Not available</p>
                    )}
                  </div>
                  {isAvailable && (
                    <Download
                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground hover:text-primary cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation()
                        downloadDocument(part)
                      }}
                    />
                  )}
                </button>
              )
            })}
          </div>
          {missingParts.length > 0 && (
            <div className="p-3 border-t border-border">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {missingParts.length} document{missingParts.length > 1 ? 's' : ''} missing
              </p>
            </div>
          )}
        </div>

        {/* ── Main column: PDF viewer + mobile tab bar ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* ── MOBILE TAB BAR (hidden on desktop) ── */}
          {endpoint.parts.length > 1 && (
            <div className="sm:hidden flex border-b border-border bg-muted/10 overflow-x-auto shrink-0 scrollbar-hide">
              {endpoint.parts.map((part) => {
                const isAvailable = documents.has(part.name)
                const isActive = activeDoc === part.name
                return (
                  <button
                    key={part.name}
                    onClick={() => isAvailable && setActiveDoc(part.name)}
                    disabled={!isAvailable || loading}
                    className={cn(
                      "flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors",
                      isActive
                        ? "border-primary text-primary bg-primary/5"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                      !isAvailable && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    {shortLabel(part.label)}
                    {isAvailable && (
                      <Download
                        className="h-3 w-3 ml-0.5 opacity-60"
                        onClick={(e) => {
                          e.stopPropagation()
                          downloadDocument(part)
                        }}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* ── PDF Viewer ── */}
          <div className="flex-1 bg-muted/20 relative overflow-hidden">
           {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Generating documents…</p>
              </div>
            ) : error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 sm:p-8">
                <AlertCircle className="h-10 w-10 text-red-500 shrink-0" />
                <p className="text-sm font-medium text-red-600 text-center">{error}</p>
                <p className="text-xs text-muted-foreground text-center max-w-md">
                  The documents could not be generated. This may happen if the record is missing
                  required sub-documents or is not in the correct status.
                </p>
              </div>
            ) : activeDoc && documents.get(activeDoc) ? (
              isNative ? (
                // Native mobile view
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 bg-muted/10">
                  <FileText className="h-16 w-16 text-primary/30" />
                  <p className="text-center text-sm text-muted-foreground max-w-xs">
                    PDFs open in your device's default viewer. Tap below to view, save, or share.
                  </p>
                  <Button onClick={() => activePart && downloadDocument(activePart)}>
                    <Eye className="h-4 w-4 mr-2" /> Open Document
                  </Button>
                </div>
              ) : (
                // Web view
                <iframe
                  src={documents.get(activeDoc)!}
                  className="w-full h-full border-0"
                  title={activePart?.label || "Document"}
                />
              )
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <Eye className="h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Select a document to view</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// COMPONENT: DocumentActionButtons
// ============================================================================

interface DocumentActionButtonsProps {
  recordId: number
  recordName?: string
  status: string
  token: string
  size?: "sm" | "default"
  className?: string
}

export function BirthDocumentActions({
  recordId,
  recordName,
  status,
  token,
  size = "sm",
  className,
}: DocumentActionButtonsProps) {
  const [viewerOpen, setViewerOpen] = useState(false)
  const [activeEndpoint, setActiveEndpoint] = useState<StreamingEndpoint | null>(null)

  const openViewer = (endpoint: StreamingEndpoint) => {
    setActiveEndpoint(endpoint)
    setViewerOpen(true)
  }

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      {status === "PENDING" && (
        <Button
          variant="ghost"
          size={size}
          className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10"
          onClick={() => openViewer(BIRTH_REVIEW_ENDPOINT)}
        >
          <Eye className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Review Docs</span>
        </Button>
      )}

      {status === "APPROVED" && (
        <>
          <Button
            variant="ghost"
            size={size}
            className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={() => openViewer(BIRTH_CERTIFICATE_ENDPOINT)}
          >
            <FileText className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Certificate</span>
          </Button>
          <Button
            variant="ghost"
            size={size}
            className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10"
            onClick={() => openViewer(BIRTH_FULL_PACK_ENDPOINT)}
          >
            <Download className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Full Pack</span>
          </Button>
        </>
      )}

      {activeEndpoint && (
        <DocumentViewer
          onClose={() => {
            setViewerOpen(false)
            setActiveEndpoint(null)
          }}
          endpoint={activeEndpoint}
          recordId={recordId}
          recordName={recordName}
          token={token}
          status={status}
        />
      )}
    </div>
  )
}

export function DeathDocumentActions({
  recordId,
  recordName,
  status,
  token,
  size = "sm",
  className,
}: DocumentActionButtonsProps) {
  const [viewerOpen, setViewerOpen] = useState(false)
  const [activeEndpoint, setActiveEndpoint] = useState<StreamingEndpoint | null>(null)

  const openViewer = (endpoint: StreamingEndpoint) => {
    setActiveEndpoint(endpoint)
    setViewerOpen(true)
  }

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      {status === "PENDING" && (
        <Button
          variant="ghost"
          size={size}
          className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10"
          onClick={() => openViewer(DEATH_REVIEW_ENDPOINT)}
        >
          <Eye className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Review Docs</span>
        </Button>
      )}

      {status === "APPROVED" && (
        <>
          <Button
            variant="ghost"
            size={size}
            className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={() => openViewer(DEATH_CERTIFICATES_ENDPOINT)}
          >
            <FileText className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Certificates</span>
          </Button>
          <Button
            variant="ghost"
            size={size}
            className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10"
            onClick={() => openViewer(DEATH_FULL_PACK_ENDPOINT)}
          >
            <Download className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Full Pack</span>
          </Button>
        </>
      )}

      {activeEndpoint && (
        <DocumentViewer
          onClose={() => {
            setViewerOpen(false)
            setActiveEndpoint(null)
          }}
          endpoint={activeEndpoint}
          recordId={recordId}
          recordName={recordName}
          token={token}
          status={status}
        />
      )}
    </div>
  )
}