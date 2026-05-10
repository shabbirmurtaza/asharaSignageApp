import { useState, type DragEvent } from 'react';
import type { Status } from '@/lib/rbac';
import type { PipelineUsage } from './api';
import { COLUMN_LABEL, type PipelineStatus } from './transitions';
import { KanbanCard } from './KanbanCard';

interface Props {
  status: PipelineStatus;
  items: PipelineUsage[];
  onTransition: (id: string, from: Status, to: Status) => void;
  onDragStart: (usage: PipelineUsage) => void;
  onDragEnd: () => void;
  onDrop: (target: PipelineStatus) => void;
  dropState?: 'allowed' | 'blocked' | null;
}

export const KanbanColumn = ({
  status,
  items,
  onTransition,
  onDragStart,
  onDragEnd,
  onDrop,
  dropState,
}: Props) => {
  const [hover, setHover] = useState(false);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (dropState === 'blocked') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!hover) setHover(true);
  };

  const stateClass =
    hover && dropState === 'allowed'
      ? 'ring-2 ring-success/60 bg-success-bg/40'
      : dropState === 'allowed'
        ? 'ring-1 ring-success/30'
        : dropState === 'blocked'
          ? 'opacity-50'
          : hover
            ? 'ring-2 ring-text/40'
            : '';

  return (
    <div
      className={`kcol ${stateClass}`}
      onDragOver={handleDragOver}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        onDrop(status);
      }}
    >
      <div className="kcol-h">
        <h3>{COLUMN_LABEL[status]}</h3>
        <span className="count">{items.length}</span>
      </div>
      <div className="kcol-body">
        {items.length === 0 && (
          <div className="rounded border border-dashed border-border-default px-3 py-6 text-center text-caption text-hint">
            No items
          </div>
        )}
        {items.map((u) => (
          <KanbanCard
            key={u.id}
            usage={u}
            onTransition={onTransition}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    </div>
  );
};
