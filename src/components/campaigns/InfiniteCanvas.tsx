"use client";

import { useCallback, useState, useRef, useEffect } from "react";

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
  const containerRef = useRef<HTMLDivElement>(null);
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
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const [noteDragStart, setNoteDragStart] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

  // Save notes to localStorage
  const saveNotes = useCallback(
    (newNotes: StickyNote[]) => {
      setNotes(newNotes);
      localStorage.setItem(`canvas-${campaignId}`, JSON.stringify(newNotes));
    },
    [campaignId]
  );

  // Track container size for minimap viewport indicator
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".sticky-note")) return;
    if (draggingNoteId) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - viewOffset.x, y: e.clientY - viewOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNoteId) {
      const note = notes.find((n) => n.id === draggingNoteId);
      if (note) {
        const deltaX = (e.clientX - noteDragStart.x) / zoom;
        const deltaY = (e.clientY - noteDragStart.y) / zoom;
        saveNotes(
          notes.map((n) =>
            n.id === draggingNoteId
              ? { ...n, x: n.x + deltaX, y: n.y + deltaY }
              : n
          )
        );
        setNoteDragStart({ x: e.clientX, y: e.clientY });
      }
      return;
    }
    
    if (!isDragging) return;
    setViewOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggingNoteId(null);
  };

  const handleNoteMouseDown = (e: React.MouseEvent, noteId: string) => {
    if (editingId === noteId) return;
    e.stopPropagation();
    setDraggingNoteId(noteId);
    setNoteDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const newZoom = Math.min(Math.max(zoom + delta, 0.25), 3);
    
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Zoom towards mouse position
      const zoomRatio = newZoom / zoom;
      setViewOffset({
        x: mouseX - (mouseX - viewOffset.x) * zoomRatio,
        y: mouseY - (mouseY - viewOffset.y) * zoomRatio,
      });
    }
    
    setZoom(newZoom);
  };

  const addNote = () => {
    const newNote: StickyNote = {
      id: Date.now().toString(),
      x: (-viewOffset.x + 50) / zoom,
      y: (-viewOffset.y + 50) / zoom,
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

  // Calculate minimap bounds
  const getCanvasBounds = () => {
    if (notes.length === 0) return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
    
    const xs = notes.flatMap(n => [n.x, n.x + n.width]);
    const ys = notes.flatMap(n => [n.y, n.y + n.height]);
    
    return {
      minX: Math.min(0, ...xs) - 100,
      minY: Math.min(0, ...ys) - 100,
      maxX: Math.max(800, ...xs) + 100,
      maxY: Math.max(600, ...ys) + 100,
    };
  };

  const bounds = getCanvasBounds();
  const minimapWidth = 150;
  const minimapHeight = 100;
  const scaleX = minimapWidth / (bounds.maxX - bounds.minX);
  const scaleY = minimapHeight / (bounds.maxY - bounds.minY);
  const minimapScale = Math.min(scaleX, scaleY);

  return (
    <div className="relative h-full overflow-hidden bg-gray-950">
      <div className="absolute left-2 top-2 z-10 flex gap-2">
        <button
          onClick={addNote}
          className="rounded bg-yellow-500 px-3 py-1.5 text-xs font-semibold text-gray-900 shadow-lg hover:bg-yellow-400"
        >
          + Post-it
        </button>
        <div className="flex items-center gap-1 rounded bg-gray-800 px-2 py-1 text-xs text-white">
          <button
            onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
            className="hover:text-purple-400"
          >
            −
          </button>
          <span className="mx-1 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(Math.min(3, zoom + 0.25))}
            className="hover:text-purple-400"
          >
            +
          </button>
        </div>
      </div>

      {/* Minimap */}
      <div className="absolute right-2 top-2 z-10 rounded border border-gray-700 bg-gray-900/90 p-1 shadow-lg">
        <svg width={minimapWidth} height={minimapHeight}>
          {/* Background */}
          <rect width={minimapWidth} height={minimapHeight} fill="#1f2937" />
          
          {/* Notes */}
          {notes.map((note) => (
            <rect
              key={note.id}
              x={(note.x - bounds.minX) * minimapScale}
              y={(note.y - bounds.minY) * minimapScale}
              width={note.width * minimapScale}
              height={note.height * minimapScale}
              fill={note.color}
              opacity={0.7}
            />
          ))}
          
          {/* Viewport indicator */}
          <rect
            x={(-viewOffset.x / zoom - bounds.minX) * minimapScale}
            y={(-viewOffset.y / zoom - bounds.minY) * minimapScale}
            width={(containerSize.width / zoom) * minimapScale}
            height={(containerSize.height / zoom) * minimapScale}
            fill="none"
            stroke="#a855f7"
            strokeWidth={2}
          />
        </svg>
      </div>

      <div
        ref={containerRef}
        className="h-full w-full cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{
          backgroundImage: `radial-gradient(circle, #374151 1px, transparent 1px)`,
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${viewOffset.x}px ${viewOffset.y}px`,
        }}
      >
        {notes.map((note) => (
          <div
            key={note.id}
            className="sticky-note absolute shadow-lg"
            style={{
              left: note.x * zoom + viewOffset.x,
              top: note.y * zoom + viewOffset.y,
              width: note.width * zoom,
              height: note.height * zoom,
              backgroundColor: note.color,
              cursor: editingId === note.id ? "default" : "grab",
            }}
            onMouseDown={(e) => handleNoteMouseDown(e, note.id)}
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
