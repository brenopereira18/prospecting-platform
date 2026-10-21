"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import type { ImageReference } from "../../schemas/prototype-base.schema";
import {
  hamburgueriaImageOptions,
  type HamburgueriaImageKey,
} from "../../templates/hamburgueria/lib/image-catalog";
import {
  resolveHamburgueriaImage,
  type ResolvedUploadImages,
} from "../../templates/hamburgueria/lib/images";
import {
  canRemoveEditorImage,
  getDefaultEditorImage,
  getEditorImage,
  getEditorImagePath,
  type EditorImageTarget,
} from "./editor-images";
import { fieldId, TextField, type PanelProps } from "./editor-fields";
import {
  TEMPORARY_IMAGE_ACCEPT,
  TEMPORARY_IMAGE_NOTICE,
  type PreparedTemporaryImage,
} from "./temporary-images";
import { getImageFramingStyle } from "../../templates/hamburgueria/lib/image-framing";
import { EditorImageFramingDialog } from "./editor-image-framing-dialog";
import {
  readFramingViewport,
  type FramingViewport,
} from "./editor-image-framing";

const buttonClass =
  "min-h-10 rounded-lg border border-sidebar-hover px-3 py-2 text-xs hover:bg-sidebar-hover focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40";

function ImageThumbnail({
  image,
  uploads = {},
}: {
  image?: ImageReference;
  uploads?: ResolvedUploadImages;
}) {
  const resolved = image ? resolveHamburgueriaImage(image, uploads) : null;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return (
    <div className="grid h-32 w-full place-items-center overflow-hidden rounded-lg bg-background">
      {resolved && failedSource !== resolved.src ? (
        <Image
          src={resolved}
          alt={image!.alt}
          width={240}
          height={128}
          className={`h-full w-full ${image?.framing ? "object-cover" : "object-contain"}`}
          sizes="240px"
          unoptimized={image?.source === "upload"}
          style={image ? getImageFramingStyle(image) : undefined}
          onError={() => setFailedSource(resolved.src)}
        />
      ) : (
        <span role="status" className="px-3 text-center text-xs text-secundary">
          {image ? "Imagem indisponível nesta sessão" : "Sem imagem"}
        </span>
      )}
    </div>
  );
}

/** Selection here is temporary; only the parent's confirmation writes to the document. */
export function EditorImageGallery({
  selectedKey,
  onSelect,
  name,
}: {
  selectedKey?: HamburgueriaImageKey;
  onSelect: (key: HamburgueriaImageKey) => void;
  name: string;
}) {
  return (
    <fieldset className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
      <legend className="mb-3 text-sm font-medium">Imagens do template</legend>
      {hamburgueriaImageOptions.map((option) => (
        <label
          key={option.key}
          className={`relative cursor-pointer rounded-xl border p-2 focus-within:outline-2 focus-within:outline-primary ${selectedKey === option.key ? "border-primary bg-primary/10" : "border-sidebar-hover"}`}
        >
          <input
            type="radio"
            name={name}
            value={option.key}
            checked={selectedKey === option.key}
            onChange={() => onSelect(option.key)}
            className="mb-2 h-4 w-4 accent-primary"
          />
          <ImageThumbnail
            image={{ source: "template", key: option.key, alt: option.alt }}
          />
          <span className="mt-2 block text-xs">{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function EditorImagePicker({
  target,
  label,
  ...props
}: PanelProps & { target: EditorImageTarget; label: string }) {
  const { document, dispatch, errors, temporaryImages } = props;
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [pendingKey, setPendingKey] = useState<HamburgueriaImageKey>();
  const [pendingUpload, setPendingUpload] = useState<PreparedTemporaryImage>();
  const [uploadError, setUploadError] = useState<string>();
  const [preparing, setPreparing] = useState(false);
  const [framingViewport, setFramingViewport] = useState<FramingViewport>();
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadRequest = useRef<AbortController | null>(null);
  const uploadDraft = useRef<PreparedTemporaryImage | null>(null);
  const discard = temporaryImages?.discard;
  const current = getEditorImage(document, target);
  const resolved = current
    ? resolveHamburgueriaImage(current, temporaryImages?.uploads)
    : null;
  const original = getDefaultEditorImage(target);
  const path = getEditorImagePath(document, target);
  const removable = canRemoveEditorImage(document, target);
  const imageErrors = Object.entries(errors).filter(
    ([key]) =>
      key === path || (key.startsWith(`${path}.`) && key !== `${path}.alt`),
  );

  useEffect(
    () => () => {
      uploadRequest.current?.abort();
      if (uploadDraft.current) discard?.(uploadDraft.current.assetId);
    },
    [discard],
  );

  function cancelUpload() {
    uploadRequest.current?.abort();
    uploadRequest.current = null;
    if (uploadDraft.current) discard?.(uploadDraft.current.assetId);
    uploadDraft.current = null;
    setPendingUpload(undefined);
    setPreparing(false);
    setUploadError(undefined);
  }

  function closeSelection() {
    cancelUpload();
    setPendingKey(undefined);
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !temporaryImages) return;
    cancelUpload();
    setPendingKey(undefined);
    const request = new AbortController();
    uploadRequest.current = request;
    setPreparing(true);
    try {
      const prepared = await temporaryImages.prepare(file, request.signal);
      if (request.signal.aborted) {
        temporaryImages.discard(prepared.assetId);
        return;
      }
      uploadDraft.current = prepared;
      setPendingUpload(prepared);
    } catch (cause) {
      if (!request.signal.aborted)
        setUploadError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível abrir a imagem.",
        );
    } finally {
      if (uploadRequest.current === request) setPreparing(false);
    }
  }

  return (
    <fieldset className="space-y-3 rounded-xl border border-sidebar-hover p-3">
      <legend className="px-1 text-sm font-medium">{label}</legend>
      <ImageThumbnail image={current} uploads={temporaryImages?.uploads} />
      {current?.source === "upload" && (
        <p className="text-xs leading-relaxed text-secundary">
          {resolveHamburgueriaImage(current, temporaryImages?.uploads)
            ? TEMPORARY_IMAGE_NOTICE
            : "Referência de arquivo enviado preservada. O arquivo ainda não está disponível nesta sessão; você pode substituí-lo por uma imagem do template ou do computador."}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          id={fieldId(path)}
          type="button"
          className={buttonClass}
          aria-haspopup="dialog"
          onClick={() => {
            cancelUpload();
            const option =
              current?.source === "template"
                ? hamburgueriaImageOptions.find(
                    (option) => option.key === current.key,
                  )
                : undefined;
            setPendingKey(option?.key);
            dialog.current?.showModal();
          }}
        >
          {current ? "Substituir imagem" : "Selecionar imagem"}
        </button>
        {target.kind !== "social" && (
          <button
            type="button"
            className={buttonClass}
            aria-haspopup="dialog"
            disabled={!current || !resolved}
            onClick={(event) => {
              if (current)
                setFramingViewport(
                  readFramingViewport(
                    event.currentTarget.ownerDocument,
                    target,
                    current,
                  ),
                );
            }}
          >
            Ajustar imagem
          </button>
        )}
        <button
          type="button"
          className={buttonClass}
          disabled={!original && !removable}
          onClick={() => dispatch({ type: "image/reset", target })}
        >
          Restaurar imagem padrão
        </button>
        {removable && current && (
          <button
            type="button"
            className={`${buttonClass} text-red-300`}
            onClick={() => dispatch({ type: "image/remove", target })}
          >
            Remover imagem
          </button>
        )}
      </div>
      {!removable && (
        <p className="text-xs text-secundary">
          {target.kind === "product"
            ? "Para remover a imagem, selecione primeiro um ícone para o produto."
            : "Esta imagem é obrigatória. Você pode substituí-la."}
        </p>
      )}
      {!original && (
        <p className="text-xs text-secundary">
          Este item não tem imagem padrão.
          {removable
            ? " Restaurar recupera a opção sem imagem."
            : " Selecione um ícone para restaurar a opção sem imagem."}
        </p>
      )}
      {imageErrors.map(([key, error]) => (
        <p key={key} role="alert" className="text-xs text-red-300">
          {error}
        </p>
      ))}
      {current && (
        <TextField
          {...props}
          path={`${path}.alt`}
          label="Texto alternativo da imagem"
          value={current.alt}
          onChange={(value) => dispatch({ type: "image/alt", target, value })}
        />
      )}
      {framingViewport && current && resolved && (
        <EditorImageFramingDialog
          image={current}
          resolved={resolved}
          viewport={framingViewport}
          label={label}
          onCancel={() => setFramingViewport(undefined)}
          onApply={(value) => {
            dispatch({ type: "image/framing", target, value });
            setFramingViewport(undefined);
          }}
        />
      )}
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClose={closeSelection}
        onCancel={closeSelection}
        className="m-auto max-h-[85dvh] w-[calc(100%_-_32px)] max-w-2xl overflow-y-auto rounded-2xl border border-sidebar-hover bg-card p-5 text-foreground backdrop:bg-black/60"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          Selecionar imagem · {label}
        </h2>
        <p className="mt-2 text-sm text-secundary">
          Escolha uma miniatura e confirme para atualizar a prévia.
        </p>
        <EditorImageGallery
          name={titleId}
          selectedKey={pendingKey}
          onSelect={(key) => {
            cancelUpload();
            setPendingKey(key);
          }}
        />
        {temporaryImages && (
          <div className="mt-5 space-y-3 border-t border-sidebar-hover pt-5">
            <button
              type="button"
              className={buttonClass}
              onClick={() => fileInput.current?.click()}
            >
              Enviar imagem do computador
            </button>
            <input
              ref={fileInput}
              type="file"
              hidden
              accept={TEMPORARY_IMAGE_ACCEPT}
              aria-label="Selecionar imagem do computador"
              onChange={selectFile}
            />
            <p className="text-xs text-secundary">
              JPG/JPEG, PNG ou WebP · até 5 MB.
            </p>
            <p className="text-xs leading-relaxed text-amber-300">
              {TEMPORARY_IMAGE_NOTICE}
            </p>
            {preparing && (
              <p role="status" className="text-sm text-secundary">
                Preparando imagem…
              </p>
            )}
            {uploadError && (
              <p role="alert" className="text-sm text-red-300">
                {uploadError}
              </p>
            )}
            {pendingUpload && (
              <div className="space-y-2 rounded-xl border border-primary p-3">
                <ImageThumbnail
                  uploads={temporaryImages.uploads}
                  image={{
                    source: "upload",
                    assetId: pendingUpload.assetId,
                    alt: current?.alt ?? pendingUpload.name,
                  }}
                />
                <p className="break-words text-xs text-secundary">
                  {pendingUpload.name}
                </p>
              </div>
            )}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              closeSelection();
              dialog.current?.close();
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={preparing || (!pendingKey && !pendingUpload)}
            className={`${buttonClass} bg-primary font-semibold text-background`}
            onClick={() => {
              if (pendingUpload && temporaryImages) {
                if (!temporaryImages.confirm(pendingUpload.assetId)) {
                  setUploadError(
                    "A imagem temporária não está mais disponível. Selecione o arquivo novamente.",
                  );
                  return;
                }
                dispatch({
                  type: "image/upload",
                  target,
                  assetId: pendingUpload.assetId,
                });
              } else if (pendingKey)
                dispatch({ type: "image/select", target, key: pendingKey });
              else return;
              closeSelection();
              dialog.current?.close();
              // The existing debounced validation receives the new document on the next render.
            }}
          >
            Confirmar imagem
          </button>
        </div>
      </dialog>
    </fieldset>
  );
}
