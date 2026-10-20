"use client";

import { EditorImagePicker } from "./editor-image-picker";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { HAMBURGUERIA_ICON_KEYS, HAMBURGUERIA_MENU_LIMITS } from "../../templates/hamburgueria/schema/hamburgueria.schema";
import { Field, TextField, fieldId, inputClass, type PanelProps } from "./editor-fields";
import type { MenuProduct } from "./editor-menu-document";
import { PriceField } from "./editor-number-fields";
import { SectionTextFields } from "./editor-section-fields";
import { OrderChannelFields } from "./editor-shared-fields";

const buttonClass = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-sidebar-hover px-3 text-xs font-medium hover:bg-sidebar-hover focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40";
const iconButtonClass = "grid h-9 w-8 shrink-0 place-items-center rounded-md text-secundary hover:bg-sidebar-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-30 disabled:cursor-not-allowed";
type MenuTab = "category" | "product" | "extra";
type DeleteTarget = { kind: MenuTab; id: string };

function ItemList({ items, selectedId, onSelect, onMove, onDelete }: {
  items: { id: string; label: string; invalid: boolean }[];
  selectedId?: string; onSelect: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <ul className="max-h-64 space-y-1 overflow-y-auto" aria-label="Itens do cardápio">
      {items.map((item, index) => (
        <li key={item.id} className={`flex min-w-0 items-center gap-0.5 rounded-lg border ${item.id === selectedId ? "border-primary/60 bg-primary/10" : "border-sidebar-hover"}`}>
          <button type="button" onClick={() => onSelect(item.id)} aria-pressed={selectedId === item.id}
            className="min-h-10 min-w-0 flex-1 rounded-md px-2 text-left text-xs focus-visible:outline-2 focus-visible:outline-primary">
            <span className="block truncate">{item.label}</span>
            {item.invalid && <span className="text-[10px] text-red-300">Revisar campos</span>}
          </button>
          <button type="button" className={iconButtonClass} disabled={index === 0} onClick={() => onMove(item.id, -1)} aria-label={`Subir ${item.label}`}><ArrowUp size={14} /></button>
          <button type="button" className={iconButtonClass} disabled={index === items.length - 1} onClick={() => onMove(item.id, 1)} aria-label={`Descer ${item.label}`}><ArrowDown size={14} /></button>
          <button type="button" className={`${iconButtonClass} hover:text-red-300`} onClick={() => onDelete(item.id)} aria-label={`Excluir ${item.label}`}><Trash2 size={14} /></button>
        </li>
      ))}
    </ul>
  );
}

function ProductFields({ product, index, document, dispatch, errors, onValidate, temporaryImages }: PanelProps & { product: MenuProduct; index: number }) {
  const path = `content.menu.products.${index}`;
  const common = { errors, onValidate };
  const edit = (changes: Partial<Pick<MenuProduct, "name" | "description" | "priceCents" | "categoryId" | "badge" | "allergens" | "vegetarian" | "icon">>) => dispatch({ type: "menu/product/edit", id: product.id, changes });
  return (
    <fieldset className="space-y-4 border-t border-sidebar-hover pt-4">
      <legend className="text-sm font-semibold">Editar produto</legend>
      <TextField {...common} path={`${path}.name`} label="Nome" value={product.name} onChange={name => edit({ name })} />
      <TextField {...common} path={`${path}.description`} label="Descrição" multiline value={product.description} onChange={description => edit({ description })} />
      <PriceField {...common} path={`${path}.priceCents`} cents={product.priceCents} onChange={priceCents => edit({ priceCents })} />
      <Field path={`${path}.categoryId`} label="Categoria" error={errors[`${path}.categoryId`]}>
        <select id={fieldId(`${path}.categoryId`)} value={product.categoryId} className={inputClass} onBlur={onValidate}
          aria-invalid={Boolean(errors[`${path}.categoryId`])}
          aria-describedby={errors[`${path}.categoryId`] ? `${fieldId(`${path}.categoryId`)}-error` : undefined}
          onChange={event => edit({ categoryId: event.target.value })}>
          {document.content.menu.categories.map(item => <option key={item.id} value={item.id}>{item.label || "Categoria sem nome"}</option>)}
        </select>
      </Field>
      <TextField {...common} path={`${path}.badge`} label="Selo promocional (opcional)" value={product.badge ?? ""} onChange={badge => edit({ badge: badge === "" ? undefined : badge })} />
      <TextField {...common} path={`${path}.allergens`} label="Informações de alergênicos (opcional)" multiline value={product.allergens ?? ""} onChange={allergens => edit({ allergens: allergens === "" ? undefined : allergens })} />
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={product.vegetarian ?? false} onChange={event => edit({ vegetarian: event.target.checked })} className="h-4 w-4 accent-primary" />Opção vegetariana
      </label>
      <Field path={`${path}.icon`} label="Ícone" error={errors[`${path}.icon`]}>
        <select id={fieldId(`${path}.icon`)} className={inputClass} value={product.icon ?? ""} onBlur={onValidate}
          aria-invalid={Boolean(errors[`${path}.icon`])}
          aria-describedby={errors[`${path}.icon`] ? `${fieldId(`${path}.icon`)}-error` : undefined}
          onChange={event => edit({ icon: event.target.value ? event.target.value as MenuProduct["icon"] : undefined })}>
          {product.image && <option value="">Sem ícone</option>}
          {HAMBURGUERIA_ICON_KEYS.map(icon => <option key={icon} value={icon}>{icon}</option>)}
        </select>
      </Field>
      <EditorImagePicker {...{ document, dispatch, errors, onValidate, temporaryImages }} target={{ kind: "product", productId: product.id }} label="Imagem do produto" />
      {product.image && <p className="text-xs leading-relaxed text-secundary">O ícone aparece nos produtos sem imagem.</p>}
    </fieldset>
  );
}

export function EditorMenuPanel(props: PanelProps) {
  const { document, dispatch, errors, onValidate } = props;
  const { menu } = document.content;
  const [tab, setTab] = useState<MenuTab>("category");
  const [selected, setSelected] = useState<Partial<Record<MenuTab, string>>>({});
  const [filter, setFilter] = useState("");
  const [pendingDelete, setPendingDelete] = useState<DeleteTarget | null>(null);
  const confirmation = useRef<HTMLDialogElement>(null);
  const categoryFilter = menu.categories.some(item => item.id === filter) ? filter : "";
  const visibleProducts = menu.products.filter(item => !categoryFilter || item.categoryId === categoryFilter);
  const category = menu.categories.find(item => item.id === selected.category) ?? menu.categories[0];
  const product = visibleProducts.find(item => item.id === selected.product) ?? visibleProducts[0];
  const extra = menu.extras.find(item => item.id === selected.extra) ?? menu.extras[0];
  const categoryIndex = menu.categories.findIndex(item => item.id === category?.id);
  const productIndex = menu.products.findIndex(item => item.id === product?.id);
  const extraIndex = menu.extras.findIndex(item => item.id === extra?.id);
  const selectedId = tab === "category" ? category?.id : tab === "product" ? product?.id : extra?.id;
  const items = tab === "category" ? menu.categories.map((item, index) => ({ id: item.id, label: `${item.label || "Sem nome"} (${menu.products.filter(product => product.categoryId === item.id).length})`, path: `content.menu.categories.${index}.` }))
    : tab === "product" ? visibleProducts.map(item => ({ id: item.id, label: item.name || "Sem nome", path: `content.menu.products.${menu.products.findIndex(product => product.id === item.id)}.` }))
      : menu.extras.map((item, index) => ({ id: item.id, label: item.name || "Sem nome", path: `content.menu.extras.${index}.` }));
  const atLimit = tab === "category" ? menu.categories.length >= HAMBURGUERIA_MENU_LIMITS.categories
    : tab === "product" ? menu.products.length >= HAMBURGUERIA_MENU_LIMITS.products : menu.extras.length >= HAMBURGUERIA_MENU_LIMITS.extras;
  const labels = { category: "categoria", product: "produto", extra: "adicional" };
  const deleteItem = pendingDelete?.kind === "category" ? menu.categories.find(item => item.id === pendingDelete.id)
    : pendingDelete?.kind === "product" ? menu.products.find(item => item.id === pendingDelete.id)
      : menu.extras.find(item => item.id === pendingDelete?.id);
  const affectedProducts = pendingDelete?.kind === "category" ? menu.products.filter(item => item.categoryId === pendingDelete.id).length : 0;
  const removesFeature = pendingDelete?.kind === "product" ? document.content.story.featured.productId === pendingDelete.id
    : pendingDelete?.kind === "category" && document.content.story.featured.targetCategoryId === pendingDelete.id;

  function addItem() {
    const id = crypto.randomUUID();
    if (tab === "category") dispatch({ type: "menu/category/add", id });
    if (tab === "extra") dispatch({ type: "menu/extra/add", id });
    if (tab === "product") {
      const categoryId = categoryFilter || menu.categories[0]?.id;
      if (!categoryId) return;
      dispatch({ type: "menu/product/add", id, categoryId });
    }
    setSelected(previous => ({ ...previous, [tab]: id }));
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold">Cardápio</h2>
        <p className="mt-2 text-xs text-secundary" aria-live="polite">{menu.categories.length} categorias · {menu.products.length} produtos · {menu.extras.length} adicionais</p>
      </div>
      <details className="space-y-4"><summary className="cursor-pointer text-sm">Textos e orientações do cardápio</summary>
        <SectionTextFields {...props} fields={[
          ["content.menu.eyebrow", "Texto de abertura"], ["content.menu.title", "Título"], ["content.menu.helpLinkLabel", "Link de ajuda"],
          ["content.menu.note", "Observação"], ["content.menu.categoryGroupLabel", "Descrição acessível das categorias"], ["content.menu.extrasHeading", "Título dos adicionais"],
          ["content.menu.vegetarianNote", "Observação vegetariana"], ["content.menu.vegetarianLabel", "Selo vegetariano"], ["content.menu.customizationNote", "Orientação de personalização", true], ["content.menu.orderButtonLabel", "Botão de pedido"],
        ]} />
      </details>
      <div className="flex flex-wrap gap-1 rounded-lg bg-background p-1" role="group" aria-label="Gerenciar cardápio">
        {([ ["category", "Categorias"], ["product", "Produtos"], ["extra", "Adicionais"] ] as const).map(([key, label]) => (
          <button type="button" key={key} aria-pressed={tab === key} onClick={() => setTab(key)}
            className={`min-h-9 flex-1 rounded-md px-2 text-xs focus-visible:outline-2 focus-visible:outline-primary ${tab === key ? "bg-sidebar-hover text-foreground" : "text-secundary hover:text-foreground"}`}>{label}</button>
        ))}
      </div>
      {tab === "product" && <Field path="menu-category-filter" label="Filtrar por categoria">
        <select id={fieldId("menu-category-filter")} className={inputClass} value={categoryFilter} onChange={event => setFilter(event.target.value)}>
          <option value="">Todas as categorias</option>
          {menu.categories.map(item => <option key={item.id} value={item.id}>{item.label || "Categoria sem nome"}</option>)}
        </select>
      </Field>}
      <button type="button" className={`${buttonClass} w-full`} disabled={atLimit || (tab === "product" && !menu.categories.length)} onClick={addItem}>
        <Plus size={14} />Adicionar {labels[tab]}
      </button>
      {atLimit && <p className="text-xs text-secundary">Limite de {tab === "category" ? HAMBURGUERIA_MENU_LIMITS.categories : tab === "product" ? HAMBURGUERIA_MENU_LIMITS.products : HAMBURGUERIA_MENU_LIMITS.extras} itens atingido.</p>}
      {tab === "product" && !menu.categories.length && <p className="text-xs leading-relaxed text-secundary">Adicione uma categoria antes de criar produtos.</p>}
      {!items.length && <p role="status" className="rounded-lg border border-dashed border-sidebar-hover p-4 text-xs text-secundary">
        {tab === "category" ? "Nenhuma categoria cadastrada." : tab === "product" ? "Nenhum produto nesta seleção." : "Nenhum adicional cadastrado."}
      </p>}
      <ItemList items={items.map(item => ({ ...item, invalid: Object.keys(errors).some(path => path.startsWith(item.path)) }))} selectedId={selectedId}
        onSelect={id => setSelected(previous => ({ ...previous, [tab]: id }))}
        onMove={(id, direction) => {
          if (tab === "category") dispatch({ type: "menu/category/move", id, direction });
          if (tab === "product") dispatch({ type: "menu/product/move", id, direction, categoryId: categoryFilter || undefined });
          if (tab === "extra") dispatch({ type: "menu/extra/move", id, direction });
        }}
        onDelete={id => { setPendingDelete({ kind: tab, id }); confirmation.current?.showModal(); }} />
      {tab === "category" && category && <fieldset className="border-t border-sidebar-hover pt-4">
        <legend className="mb-4 text-sm font-semibold">Editar categoria</legend>
        <TextField errors={errors} onValidate={onValidate} path={`content.menu.categories.${categoryIndex}.label`} label="Nome da categoria" value={category.label}
          onChange={label => dispatch({ type: "menu/category/edit", id: category.id, label })} />
      </fieldset>}
      {tab === "product" && product && <ProductFields key={product.id} {...props} product={product} index={productIndex} />}
      {tab === "extra" && extra && <fieldset key={extra.id} className="space-y-4 border-t border-sidebar-hover pt-4">
        <legend className="text-sm font-semibold">Editar adicional</legend>
        <TextField errors={errors} onValidate={onValidate} path={`content.menu.extras.${extraIndex}.name`} label="Nome do adicional" value={extra.name}
          onChange={name => dispatch({ type: "menu/extra/edit", id: extra.id, changes: { name } })} />
        <PriceField errors={errors} onValidate={onValidate} path={`content.menu.extras.${extraIndex}.priceCents`} cents={extra.priceCents}
          onChange={priceCents => dispatch({ type: "menu/extra/edit", id: extra.id, changes: { priceCents } })} />
      </fieldset>}
      <OrderChannelFields {...props} product />
      <dialog ref={confirmation} aria-labelledby="menu-delete-title" onClose={() => setPendingDelete(null)}
        className="m-auto w-[calc(100%_-_32px)] max-w-md rounded-2xl border border-sidebar-hover bg-card p-6 text-foreground backdrop:bg-black/60">
        <h2 id="menu-delete-title" className="text-lg font-semibold">Excluir {pendingDelete ? labels[pendingDelete.kind] : "item"}?</h2>
        <p className="mt-3 break-words text-sm text-secundary">{deleteItem && ("label" in deleteItem ? deleteItem.label : deleteItem.name)}</p>
        {pendingDelete?.kind === "category" && <p className="mt-3 text-sm text-secundary">{affectedProducts} {affectedProducts === 1 ? "produto vinculado será excluído" : "produtos vinculados serão excluídos"} junto com a categoria.</p>}
        {removesFeature && <p className="mt-3 text-sm text-amber-300">A oferta em destaque na seção História também será removida. O texto institucional será preservado.</p>}
        <p className="mt-3 text-xs text-secundary">Esta ação pode ser cancelada agora. Depois, só será possível restaurar o documento padrão completo.</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className={buttonClass} onClick={() => confirmation.current?.close()}>Cancelar</button>
          <button type="button" className={`${buttonClass} border-red-400/30 text-red-300`} disabled={!deleteItem} onClick={() => {
            if (!pendingDelete) return;
            if (pendingDelete.kind === "category") dispatch({ type: "menu/category/delete", id: pendingDelete.id });
            if (pendingDelete.kind === "product") dispatch({ type: "menu/product/delete", id: pendingDelete.id });
            if (pendingDelete.kind === "extra") dispatch({ type: "menu/extra/delete", id: pendingDelete.id });
            confirmation.current?.close();
          }}>Confirmar exclusão</button>
        </div>
      </dialog>
    </div>
  );
}
