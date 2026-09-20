import { useEffect, useRef, useState } from 'react';

interface DateFieldProps {
  label: string;
  value: string; // ISO "YYYY-MM-DD", or '' for empty
  onChange: (value: string) => void;
  className?: string;
}

/** Keeps only digits, capped at 8 (DDMMYYYY). */
function toDigits(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 8);
}

/** "DDMMYYYY" (partial or full) -> "DD/MM/YYYY" (partial or full), for display while typing. */
function digitsToDisplay(digits: string): string {
  const d = digits.slice(0, 2);
  const m = digits.slice(2, 4);
  const y = digits.slice(4, 8);
  let out = d;
  if (m) out += '/' + m;
  if (y) out += '/' + y;
  return out;
}

/** ISO "YYYY-MM-DD" -> "DDMMYYYY" digit string ('' if empty/unparseable). */
function isoToDigits(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return '';
  const [, y, m, d] = match;
  return d + m + y;
}

/**
 * A full 8-digit "DDMMYYYY" -> ISO "YYYY-MM-DD", but only if it's a
 * real calendar date. Rejects impossible dates (31/02, day 32, month
 * 13, Feb 30, ...) by round-tripping through Date and checking every
 * part survived unchanged — an invalid date like "31/02/2026" rolls
 * over to March, which won't match the day/month typed.
 */
function digitsToIso(digits: string): string | null {
  if (digits.length !== 8) return null;
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  if (year < 1000 || year > 9999) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * The visible control is a plain text input that WE format and
 * validate as DD/MM/YYYY — never the native <input type="date">,
 * whose displayed format is controlled by OS/browser locale and
 * can't be reliably forced to DD/MM/YYYY from the web page (this is
 * exactly what caused the bug: macOS/Safari was rendering it as
 * MM/DD/YYYY regardless of what we did in CSS).
 *
 * A hidden native date input is kept purely as the picker mechanism
 * behind the calendar button — its own on-screen rendering is never
 * shown, only its picker UI, and its value is always kept in sync
 * with the same ISO string the text field produces.
 */
export default function DateField({ label, value, onChange, className }: DateFieldProps) {
  const [digits, setDigits] = useState(() => isoToDigits(value));
  const [touched, setTouched] = useState(false);
  const pickerRef = useRef<HTMLInputElement | null>(null);

  // Stay in sync if the ISO value changes from outside this field
  // (e.g. a different record is loaded into the same open editor).
  useEffect(() => {
    setDigits(isoToDigits(value));
  }, [value]);

  const displayValue = digitsToDisplay(digits);
  const isComplete = digits.length === 8;
  const parsedIso = isComplete ? digitsToIso(digits) : null;
  const showInvalid = touched && isComplete && parsedIso === null;

  const commitDigits = (nextDigits: string) => {
    setDigits(nextDigits);
    if (nextDigits.length === 0) {
      onChange('');
      return;
    }
    if (nextDigits.length === 8) {
      const iso = digitsToIso(nextDigits);
      // Only propagate a genuinely valid date. An impossible date
      // (e.g. 31/02/2026) is shown with an inline error instead of
      // being saved — the last valid value stays in effect until
      // it's corrected.
      if (iso) onChange(iso);
    }
  };

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    const withPicker = el as HTMLInputElement & { showPicker?: () => void };
    if (typeof withPicker.showPicker === 'function') {
      try {
        withPicker.showPicker();
        return;
      } catch {
        // Fall through to focus/click below.
      }
    }
    el.focus();
    el.click();
  };

  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-sand-900 mb-1">{label}</label>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="DD/MM/YYYY"
          value={displayValue}
          onChange={(e) => commitDigits(toDigits(e.target.value))}
          onBlur={() => setTouched(true)}
          maxLength={10}
          className={`w-full p-2.5 pr-10 bg-sand-50 border rounded-xl text-sand-900 focus:outline-none ${
            showInvalid ? 'border-terracotta-400' : 'border-sand-200 focus:border-sand-300'
          }`}
        />
        <button
          type="button"
          onClick={openPicker}
          aria-label="Open calendar to pick a date"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-sand-800/50 hover:text-sand-900 text-sm"
        >
          📅
        </button>
        {/* Picker-only — never visibly rendered. Its own value stays
            ISO and in sync with the text field above. */}
        <input
          ref={pickerRef}
          type="date"
          value={value}
          onChange={(e) => {
            setDigits(isoToDigits(e.target.value));
            setTouched(false);
            onChange(e.target.value);
          }}
          tabIndex={-1}
          aria-hidden="true"
          className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
        />
      </div>
      {showInvalid && <p className="text-[10px] text-terracotta-600 mt-1">That date doesn't look right.</p>}
    </div>
  );
}
