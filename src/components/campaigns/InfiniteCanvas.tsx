"use client";

import { useCallback, useState } from "react";

type StickyNote = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color: string;
};

type InfiniteCanvasProps = {
  campaignId: string;
};

const COLORS = ["#fef08a", "#bfdbfe", "#d9f99d", "#fecaca", "#e9d5ff", "#fed7aa"];

export function InfiniteCanvas({ campaignId }: InfiniteCanvasProps) {
  const [notes, setNotes] = useState<StickyNote[]>(() => {
    // Initialize from localStorage
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`canvas-${campaignId}`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return [];
        }
      }
    }
    return [];
  });
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  // Save notes to localStorage
  const saveNotes = useCallback(
    (newNotes: StickyNote[]) => {
      setNotes(newNotes);
      localStorage.setItem(`canvas-${campaignId}`, JSON.stringify(newNotes));
    },
    [campaignId]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".sticky-note")) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - viewOffset.x, y: e.clientY - viewOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setViewOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const addNote = () => {
    const newNote: StickyNote = {
      id: Date.now().toString(),
      x: -viewOffset.x + 50,
      y: -viewOffset.y + 50,
      width: 200,
      height: 150,
      content: "",
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    };
    saveNotes([...notes, newNote]);
    setEditingId(newNote.id);
    setEditContent("");
  };

  const deleteNote = (id: string) => {
    saveNotes(notes.filter((n) => n.id !== id));
  };

  const startEdit = (note: StickyNote) => {
    setEditingId(note.id);
    setEditContent(note.content);
  };

  const saveEdit = () => {
    if (editingId) {
      saveNotes(notes.map((n) => (n.id === editingId ? { ...n, content: editContent } : n)));
    }
    setEditingId(null);
  };

  return (
    <div className="relative h-full overflow-hidden bg-gray-950">
      <div className="absolute right-2 top-2 z-10">
        <button
          onClick={addNote}
          className="rounded bg-yellow-500 px-3 py-1.5 text-xs font-semibold text-gray-900 shadow-lg hover:bg-yellow-400"
        >
          + Post-it
        </button>
      </div>

      <div
        className="h-full w-full cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          backgroundImage: `radial-gradient(circle, #374151 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
          backgroundPosition: `${viewOffset.x}px ${viewOffset.y}px`,
        }}
      >
        {notes.map((note) => (
          <div
            key={note.id}
            className="sticky-note absolute cursor-pointer shadow-lg"
            style={{
              left: note.x + viewOffset.x,
              top: note.y + viewOffset.y,
              width: note.width,
              height: note.height,
              backgroundColor: note.color,
            }}
            onDoubleClick={() => startEdit(note)}
          >
            <div className="flex h-full flex-col p-2">
              <div className="mb-1 flex items-center justify-between">
                <div className="h-1 w-8 rounded bg-black/10" />
                <button
                  onClick={() => deleteNote(note.id)}
                  className="text-xs text-gray-700 hover:text-red-600"
                >
                  ✕
                </button>
              </div>
              {editingId === note.id ? (
                <div className="flex h-full flex-col gap-1">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="flex-1 resize-none rounded border-none bg-transparent p-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    autoFocus
                  />
                  <button
                    onClick={saveEdit}
                    className="rounded bg-gray-900 px-2 py-0.5 text-xs text-white hover:bg-gray-800"
                  >
                    Salvar
                  </button>
                </div>
              ) : (
                <p className="flex-1 overflow-auto whitespace-pre-wrap break-words text-sm text-gray-900">
                  {note.content || "Duplo clique para editar"}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
