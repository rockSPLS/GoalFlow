"use client";

import { GripVertical } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";

// Ручка перетаскивания задачи в календаре. Перетаскивание — мышью и касанием; с клавиатуры
// то же меняется в карточке задачи, поэтому ручка не попадает в порядок перехода по Tab и скрыта от экранного диктора
export function DragHandle({ id, title }: { id: string; title: string }) {
  const { listeners, setNodeRef } = useDraggable({ id });
  return <Grip ref={setNodeRef} title={title} {...listeners} />;
}

// Сама ручка ⠿ без перетаскивания — для карточки доски, которую тянут целиком (обработчики на карточке).
// touch-none: касание ручки не прокручивает страницу — с ручки удобно начинать перенос пальцем
export function Grip({ title, ...rest }: { title: string } & React.ComponentProps<"span">) {
  return (
    <span
      {...rest}
      aria-hidden="true"
      title={title}
      className="-ml-1 flex shrink-0 cursor-grab touch-none items-center self-stretch px-0.5 text-zinc-400 hover:text-zinc-700 active:cursor-grabbing dark:hover:text-zinc-200"
    >
      <GripVertical size={16} />
    </span>
  );
}
