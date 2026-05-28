"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { handleSignOut, handleUpdateDisplayName } from "./actions";

interface Props {
  initials:    string;
  name:        string;
  email:       string;
}

export default function ProfileButton({ initials, name, email }: Props) {
  const [open,      setOpen]      = useState(false);
  const [editing,   setEditing]   = useState(false);
  const [nameVal,   setNameVal]   = useState(name);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState("");
  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router   = useRouter();

  // Close on outside click / touch
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setEditing(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open]);

  // Escape key to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); setEditing(false); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Auto-focus name input when editing opens
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function toggleOpen() {
    setOpen(o => {
      if (o) { setEditing(false); setSaveError(""); }
      return !o;
    });
  }

  async function save() {
    const trimmed = nameVal.trim();
    if (!trimmed) { setSaveError("Name can't be empty."); return; }
    if (trimmed === name) { setEditing(false); return; }
    setSaving(true);
    setSaveError("");
    const result = await handleUpdateDisplayName(trimmed);
    setSaving(false);
    if (result?.error) {
      setSaveError(result.error);
    } else {
      setEditing(false);
      router.refresh(); // re-render server layout to update initials
    }
  }

  function cancelEdit() {
    setEditing(false);
    setNameVal(name);
    setSaveError("");
  }

  return (
    <div ref={wrapRef} className="relative">

      {/* Avatar button */}
      <button
        onClick={toggleOpen}
        aria-label="Profile menu"
        aria-expanded={open}
        aria-haspopup="true"
        className={`h-8 w-8 rounded-full bg-ink text-paper flex items-center justify-center
          text-[10.5px] font-semibold tracking-wide flex-shrink-0 transition-all
          ring-2 ${open ? "ring-accent/50 bg-accent" : "ring-transparent hover:ring-accent/30"}`}
      >
        {initials}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-[calc(100%+10px)] w-72 bg-paper border border-line rounded-xl shadow-lift z-50 overflow-hidden"
          style={{ animation: "scaleIn 160ms cubic-bezier(0.16, 1, 0.3, 1) both", transformOrigin: "top right" }}
        >

          {/* ── Account ── */}
          <div className="px-4 py-3.5 border-b border-[color:var(--line-soft)]">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] ink-faint mb-1">
              Signed in as
            </p>
            <p className="text-[12px] ink-soft truncate">{email}</p>
          </div>

          {/* ── Display name ── */}
          <div className="px-4 py-3.5 border-b border-[color:var(--line-soft)]">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] ink-faint mb-2.5">
              Display name
            </p>

            {editing ? (
              <div className="space-y-2.5">
                <input
                  ref={inputRef}
                  type="text"
                  value={nameVal}
                  onChange={e => { setNameVal(e.target.value); setSaveError(""); }}
                  onKeyDown={e => {
                    if (e.key === "Enter")  { e.preventDefault(); save(); }
                    if (e.key === "Escape") cancelEdit();
                  }}
                  maxLength={40}
                  placeholder="Your name"
                  className="w-full px-3 py-2 text-[13.5px] bg-card border border-line rounded-lg ink
                    outline-none focus:border-ink/40 transition-colors"
                />
                {saveError && (
                  <p className="text-[11.5px] text-accent font-medium">{saveError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={save}
                    disabled={saving}
                    className="flex-1 px-3 py-1.5 text-[12.5px] font-semibold bg-ink text-paper
                      rounded-lg hover:bg-accent disabled:opacity-50 transition-colors"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-3 py-1.5 text-[12.5px] ink-soft border border-line rounded-lg
                      hover:border-ink/30 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="w-full flex items-center justify-between gap-3 group"
              >
                <span
                  className="font-serif text-[15px] font-medium ink truncate"
                  style={{ fontVariationSettings: '"opsz" 24' }}
                >
                  {nameVal}
                </span>
                <span className="font-mono text-[10px] ink-faint/50 group-hover:ink-faint flex-shrink-0 transition-colors">
                  edit →
                </span>
              </button>
            )}
          </div>

          {/* ── Sign out ── */}
          <div className="px-4 py-3">
            <form action={handleSignOut}>
              <button
                type="submit"
                className="w-full text-left text-[13px] font-medium text-accent/80
                  hover:text-accent transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>

        </div>
      )}
    </div>
  );
}
