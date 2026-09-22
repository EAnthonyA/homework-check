"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Images, Loader2, X } from "lucide-react";
import { MAX_PHOTOS, validatePhotos } from "@/lib/upload-rules";

type DraftPhoto = { file: File; url: string };

export function PhotoSubmission({ homeworkId, replacing, onResult }: {
  homeworkId: string;
  replacing: boolean;
  onResult: (message: string) => void;
}) {
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const urls = useRef(new Set<string>());
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const allocated = urls.current;
    return () => { allocated.forEach((url) => URL.revokeObjectURL(url)); };
  }, []);

  function clearPhotos() {
    urls.current.forEach((url) => URL.revokeObjectURL(url));
    urls.current.clear();
    setPhotos([]);
  }

  const upload = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append("homeworkId", homeworkId);
      photos.forEach(({ file }) => form.append("file", file));
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Nepavyko pateikti. Bandyk dar kartą.");
      return body as { completed: boolean; calendarFailed: number; ai: { done: boolean; correct: boolean | null } | null };
    },
    onSuccess: (result) => {
      clearPhotos();
      onResult(result.completed
        ? `AI patvirtino, kad darbas atliktas teisingai. Nuotraukos išsaugotos istorijoje.${result.calendarFailed ? " Nepavyko atnaujinti kalendoriaus — pranešk tėvams." : ""}`
        : result.ai?.done && result.ai.correct === false
          ? "AI rado klaidų. Perskaityk komentarą prie užduoties, pataisyk ir pateik iš naujo."
          : "Nuotraukos išsaugotos. Peržiūrėk vertinimą prie užduoties.");
      queryClient.invalidateQueries({ queryKey: ["homework"] });
    },
    onError: (cause) => setError(cause.message),
  });

  function addPhotos(selected: FileList | null) {
    if (!selected?.length || upload.isPending) return;
    const files = Array.from(selected);
    try {
      validatePhotos([...photos.map((photo) => photo.file), ...files]);
      const added = files.map((file) => {
        const url = URL.createObjectURL(file);
        urls.current.add(url);
        return { file, url };
      });
      setPhotos([...photos, ...added]);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nepavyko pasirinkti nuotraukų.");
    }
  }

  return (
    <div className="mt-4 border-t border-dashed border-rule pt-4" aria-busy={upload.isPending}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-ink">{replacing ? "Pateikti iš naujo" : "Tavo sprendimas"}</p>
        <span className="text-xs text-ink-soft">{photos.length} / {MAX_PHOTOS} nuotraukos</span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-ink-soft">
        {replacing ? "Naujos nuotraukos pakeis ankstesnį pateikimą. " : ""}
        Pridėk visus puslapius — įvertinsiu kartu. Iki 10 MB vienai nuotraukai.
      </p>
      {photos.length > 0 && (
        <ol className="mt-3 grid grid-cols-3 gap-2">
          {photos.map((photo, index) => (
            <li key={photo.url} className="min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={`${index + 1} pasirinkta nuotrauka`}
                className="aspect-[3/4] w-full rounded-lg border border-rule bg-paper object-cover" />
              <button type="button" disabled={upload.isPending}
                aria-label={`Pašalinti ${index + 1} nuotrauką`}
                className="flex min-h-11 w-full items-center justify-center gap-1 rounded-lg text-xs text-pen-deep hover:bg-paper disabled:opacity-50"
                onClick={() => {
                  URL.revokeObjectURL(photo.url);
                  urls.current.delete(photo.url);
                  setPhotos(photos.filter((entry) => entry !== photo));
                  setError(null);
                }}><X className="h-4 w-4" /> {index + 1} · Pašalinti</button>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-outline flex-1" disabled={upload.isPending || photos.length >= MAX_PHOTOS}
          onClick={() => camera.current?.click()}><Camera className="h-4 w-4" /> Fotografuoti</button>
        <button type="button" className="btn btn-outline flex-1" disabled={upload.isPending || photos.length >= MAX_PHOTOS}
          onClick={() => gallery.current?.click()}><Images className="h-4 w-4" /> Iš galerijos</button>
      </div>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" disabled={upload.isPending}
        onChange={(event) => { addPhotos(event.target.files); event.target.value = ""; }} />
      <input ref={gallery} type="file" accept="image/*" multiple className="hidden" disabled={upload.isPending}
        onChange={(event) => { addPhotos(event.target.files); event.target.value = ""; }} />
      {photos.length > 0 && (
        <button type="button" className="btn btn-primary mt-3 w-full" disabled={upload.isPending}
          onClick={() => { setError(null); upload.mutate(); }}>
          {upload.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Įkeliama ir vertinama…</> : "Pateikti vertinimui"}
        </button>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-pen-deep">{error}</p>}
    </div>
  );
}
