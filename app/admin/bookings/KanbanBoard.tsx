"use client";

import { useState } from "react";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { updateBookingStatus } from "./actions";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

interface KanbanColumn {
  id: BookingStatus;
  label: string;
  color: string;
}

const COLUMNS: KanbanColumn[] = [
  { id: "PENDING", label: "New Leads", color: "#FEF3C7" },
  { id: "QUALIFIED", label: "Qualified", color: "#E0E7FF" },
  { id: "SENT_PROPOSAL", label: "Proposal Sent", color: "#DBEAFE" },
  { id: "CONTRACT_SENT", label: "Contract Out", color: "#FED7AA" },
  { id: "BOOKED", label: "Booked", color: "#D1FAE5" },
];

export function KanbanBoard({ inquiries }: { inquiries: Inquiry[] }) {
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    
    await updateBookingStatus(
      active.id as string, 
      over.id as BookingStatus
    );
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-5 gap-4">
        {COLUMNS.map(col => (
          <KanbanColumn 
            key={col.id} 
            column={col}
            inquiries={inquiries.filter(i => i.status === col.id)}
          />
        ))}
      </div>
    </DndContext>
  );
}
// --- Kanban Column Component ---
function KanbanColumn({ column, inquiries, onCardClick }: { 
  column: KanbanColumn, 
  inquiries: Inquiry[],
  onCardClick: (inquiry: Inquiry) => void 
}) {
  const { isOver, setNodeRef } = useDroppable({ id: column.id });

  return (
    <div 
      ref={setNodeRef}
      className={`flex flex-col rounded-lg bg-gray-50 p-4 transition-colors ${
        isOver ? "ring-2 ring-blue-400 bg-blue-50/50" : ""
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{column.label}</h3>
        <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded-full shadow-sm">
          {inquiries.length}
        </span>
      </div>
      <div className="flex flex-col gap-3 min-h-[200px]">
        {inquiries.map((inquiry) => (
          <KanbanCard 
            key={inquiry.id} 
            inquiry={inquiry} 
            onClick={() => onCardClick(inquiry)} 
          />
        ))}
      </div>
    </div>
  );
}

// --- Kanban Card Component ---
function KanbanCard({ inquiry, onClick }: { inquiry: Inquiry, onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: inquiry.id,
    data: inquiry, // Pass the whole object if needed later
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className="bg-white p-3 rounded shadow-sm border border-gray-200 cursor-grab active:cursor-grabbing hover:border-gray-300 transition-all group"
    >
      <div className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
        {inquiry.firstName} {inquiry.lastName}
      </div>
      <div className="text-xs text-gray-500 mt-1 truncate">{inquiry.sessionType}</div>
      {inquiry.tags && inquiry.tags.length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {inquiry.tags.map(tag => (
            <span key={tag} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}