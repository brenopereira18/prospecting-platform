"use client";

import { useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { TextField, type PanelProps } from "./editor-fields";
import { EditorSelect } from "./editor-section-fields";
import { getSectionItems, getSectionStrings, sectionListRules, sectionStringRules, type SectionItem, type SectionList, type SectionStringList } from "./editor-section-document";

const buttonClass = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-sidebar-hover px-3 text-xs hover:bg-sidebar-hover focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40";

function CollectionControls({ label, count, min, max, index, onAdd, onDelete, onMove }: {
  label: string; count: number; min: number; max: number; index: number;
  onAdd: () => void; onDelete: () => void; onMove: (direction: -1 | 1) => void;
}) {
  return <div className="space-y-3">
    <p className="text-xs text-secundary" aria-live="polite">{count} itens · {min === max ? `Quantidade fixa: ${min}` : `Mínimo ${min}, máximo ${max}`}</p>
    <div className="flex flex-wrap gap-2">
      {min !== max && <button type="button" className={buttonClass} disabled={count >= max} onClick={onAdd}><Plus size={14} />Adicionar {label}</button>}
      <button type="button" className={buttonClass} disabled={index <= 0} onClick={() => onMove(-1)} aria-label={`Subir ${label}`}><ArrowUp size={14} /></button>
      <button type="button" className={buttonClass} disabled={index < 0 || index >= count - 1} onClick={() => onMove(1)} aria-label={`Descer ${label}`}><ArrowDown size={14} /></button>
      {min !== max && <button type="button" className={`${buttonClass} text-red-300`} disabled={count <= min} onClick={onDelete}><Trash2 size={14} />Excluir</button>}
    </div>
    {min > 0 && count <= min && <p className="text-xs leading-relaxed text-secundary">{min === max ? "O contrato exige exatamente essa quantidade de itens. Você pode editar e reordenar." : `O contrato exige pelo menos ${min} item. Para ocultar a seção, use Visibilidade.`}</p>}
  </div>;
}

function DeleteDialog({ dialogRef, id, label, onConfirm }: {
  dialogRef: React.RefObject<HTMLDialogElement | null>; id: string; label: string; onConfirm: () => void;
}) {
  return <dialog ref={dialogRef} aria-labelledby={`${id}-title`} className="m-auto w-[calc(100%_-_32px)] max-w-md rounded-2xl border border-sidebar-hover bg-card p-6 text-foreground backdrop:bg-black/60">
    <h3 id={`${id}-title`} className="text-lg font-semibold">Excluir {label}?</h3>
    <p className="mt-3 text-sm text-secundary">O item será removido do documento desta sessão.</p>
    <div className="mt-6 flex justify-end gap-3">
      <button type="button" className={buttonClass} onClick={() => dialogRef.current?.close()}>Cancelar</button>
      <button type="button" className={`${buttonClass} text-red-300`} onClick={() => { onConfirm(); dialogRef.current?.close(); }}>Confirmar exclusão</button>
    </div>
  </dialog>;
}

function itemLabel(item: SectionItem<SectionList>) {
  return "name" in item ? item.name : "question" in item ? item.question : item.title;
}

export function ItemCollection<K extends SectionList>({ list, renderItem, ...props }: PanelProps & {
  list: K; renderItem: (item: SectionItem<K>, index: number) => ReactNode;
}) {
  const items = getSectionItems(props.document, list);
  const rules = sectionListRules[list];
  const [selected, setSelected] = useState<string>();
  const pendingId = useRef<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const item = items.find(item => item.id === selected) ?? items[0];
  const index = item ? items.findIndex(candidate => candidate.id === item.id) : -1;
  return <div className="space-y-4">
    <CollectionControls {...rules} count={items.length} index={index} onAdd={() => {
      if (list === "steps") return;
      const id = crypto.randomUUID(); props.dispatch({ type: "sectionItem/add", list, id }); setSelected(id);
    }} onDelete={() => { pendingId.current = item?.id ?? null; dialog.current?.showModal(); }}
      onMove={direction => { if (item) props.dispatch({ type: "sectionItem/move", list, id: item.id, direction }); }} />
    {!item ? <p role="status" className="rounded-lg border border-dashed border-sidebar-hover p-4 text-xs text-secundary">Nenhum item cadastrado.</p> : <>
      <EditorSelect {...props} path={`${rules.path}-selection`} label={`Selecionar ${rules.label}`} value={item.id}
        options={items.map(item => [item.id, itemLabel(item) || "Sem título"] as const)} onChange={setSelected} />
      <div key={item.id} className="space-y-4 border-t border-sidebar-hover pt-4">{renderItem(item, index)}</div>
    </>}
    {props.errors[rules.path] && <p role="alert" className="text-xs text-red-300">{props.errors[rules.path]}</p>}
    <DeleteDialog dialogRef={dialog} id={`delete-${list}`} label={rules.label} onConfirm={() => {
      if (list !== "steps" && pendingId.current) props.dispatch({ type: "sectionItem/delete", list, id: pendingId.current });
    }} />
  </div>;
}

export function StringCollection({ list, ...props }: PanelProps & { list: SectionStringList }) {
  const items = getSectionStrings(props.document, list);
  const rules = sectionStringRules[list];
  const [selection, setSelection] = useState(0);
  const index = Math.min(selection, items.length - 1);
  const pending = useRef(-1);
  const dialog = useRef<HTMLDialogElement>(null);
  return <div className="space-y-4">
    <CollectionControls {...rules} count={items.length} index={index} onAdd={() => {
      props.dispatch({ type: "sectionStrings/add", list }); setSelection(items.length);
    }} onDelete={() => { pending.current = index; dialog.current?.showModal(); }} onMove={direction => {
      props.dispatch({ type: "sectionStrings/move", list, index, direction }); setSelection(index + direction);
    }} />
    <EditorSelect {...props} path={`${rules.path}-selection`} label={`Selecionar ${rules.label}`} value={String(index)}
      options={items.map((value, index) => [String(index), `${index + 1}. ${value || "Sem texto"}`] as const)} onChange={value => setSelection(Number(value))} />
    {index >= 0 && <TextField {...props} path={`${rules.path}.${index}`} label={list === "paragraphs" ? "Parágrafo" : "Horário de funcionamento"} multiline value={items[index]}
      onChange={value => props.dispatch({ type: "sectionStrings/edit", list, index, value })} />}
    <DeleteDialog dialogRef={dialog} id={`delete-${list}`} label={rules.label} onConfirm={() => props.dispatch({ type: "sectionStrings/delete", list, index: pending.current })} />
  </div>;
}
