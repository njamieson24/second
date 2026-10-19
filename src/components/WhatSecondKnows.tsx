"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "./Button";
import { Card } from "./Card";
import { SampleTag } from "./EmptyStates";
import { inputClass } from "./Field";
import { TextLink } from "./TextLink";
import { NOTE_MAX_CHARS, type BusinessNote } from "@/lib/chat";
import { clearNotes, deleteNote, getNotes, updateNote } from "@/lib/store";

/** Settings: the short notes Second saved from chats. The owner can edit, delete, or clear them all. */
export function WhatSecondKnows() {
  const [notes, setNotes] = useState<BusinessNote[] | null>(null);
  const [sample, setSample] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let live = true;
    getNotes().then((r) => {
      if (!live) return;
      if (r.ok) {
        setNotes(r.notes);
        setSample(r.sample);
      } else setProblem(r.message);
    });
    return () => {
      live = false;
    };
  }, []);

  async function clearAll() {
    setClearing(true);
    if (await clearNotes()) {
      setNotes([]);
      setConfirmClear(false);
    } else setProblem("We couldn't clear the notes. Please try again.");
    setClearing(false);
  }

  return (
    <Card title="What Second knows" aside={sample ? <SampleTag /> : undefined} tourId="what-second-knows">
      <p className="mt-1.5 mb-4 text-[15px] leading-normal text-muted">
        Second saves short notes from your chats so it remembers what matters. You&apos;re in control.
      </p>

      {problem && <p className="mt-0 mb-3 text-[15px]">{problem}</p>}
      {notes === null && !problem && <p className="m-0 text-[15px] text-muted">Loading…</p>}
      {notes?.length === 0 && (
        <p className="m-0 rounded-row bg-paper px-4 py-3.5 text-[15px] text-muted">
          Nothing yet. As you chat, Second will save short notes here.
        </p>
      )}

      {notes && notes.length > 0 && (
        <ul className="m-0 flex list-none flex-col p-0">
          {notes.map((n, i) => (
            <NoteRow
              key={n.id}
              note={n}
              readOnly={sample}
              last={i === notes.length - 1}
              onSaved={(text) => setNotes((all) => all?.map((x) => (x.id === n.id ? { ...x, note: text } : x)) ?? null)}
              onDeleted={() => setNotes((all) => all?.filter((x) => x.id !== n.id) ?? null)}
            />
          ))}
        </ul>
      )}

      {sample && (
        <p className="mt-4 mb-0 text-[15px] text-muted">
          These are sample notes. <TextLink href="/signup">Make an account</TextLink> and Second
          will start remembering what matters to you.
        </p>
      )}

      {!sample && notes && notes.length > 0 && (
        <div className="mt-4">
          {confirmClear ? (
            <div className="rounded-row border border-line-strong bg-paper p-4" role="alert">
              <p className="mt-0 mb-3 text-[15px] font-medium">
                Delete all {notes.length} {notes.length === 1 ? "note" : "notes"}? This can&apos;t be undone.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="dark" onClick={clearAll} disabled={clearing}>
                  {clearing ? "Clearing…" : "Yes, clear all"}
                </Button>
                <Button variant="ghost" weight="medium" onClick={() => setConfirmClear(false)}>
                  Keep them
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" weight="medium" onClick={() => setConfirmClear(true)}>
              Clear all
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function NoteRow({
  note,
  readOnly,
  last,
  onSaved,
  onDeleted,
}: {
  note: BusinessNote;
  readOnly: boolean;
  last: boolean;
  onSaved: (text: string) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.note);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const id = `note-${note.id}`;

  async function save() {
    const clean = text.trim();
    if (!clean) return setProblem("A note can't be empty. Use Delete to remove it.");
    setBusy(true);
    const ok = await updateNote(note.id, clean);
    setBusy(false);
    if (!ok) return setProblem("We couldn't save that. Please try again.");
    onSaved(clean);
    setEditing(false);
    setProblem(null);
  }

  async function remove() {
    setBusy(true);
    if (await deleteNote(note.id)) onDeleted();
    else {
      setBusy(false);
      setProblem("We couldn't delete that. Please try again.");
    }
  }

  return (
    <li className={`flex flex-col gap-2 py-3 ${last ? "" : "border-b border-line-soft"}`}>
      {editing ? (
        <>
          <label htmlFor={id} className="sr-only">
            Edit note
          </label>
          <textarea
            id={id}
            value={text}
            maxLength={NOTE_MAX_CHARS}
            rows={2}
            onChange={(e) => setText(e.target.value)}
            className={`${inputClass} min-h-20 resize-y py-2.5 leading-normal`}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              weight="medium"
              onClick={() => {
                setEditing(false);
                setText(note.note);
                setProblem(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <div className="flex items-start gap-3">
          <p className="m-0 grow pt-2.5 text-[15px] leading-normal">{note.note}</p>
          {!readOnly && (
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label={`Edit note: ${note.note}`}
                className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-line-soft hover:text-ink"
              >
                <Pencil size={17} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                aria-label={`Delete note: ${note.note}`}
                className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-line-soft hover:text-ink disabled:opacity-50"
              >
                <Trash2 size={17} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}
      {problem && <p className="m-0 text-sm">{problem}</p>}
    </li>
  );
}
