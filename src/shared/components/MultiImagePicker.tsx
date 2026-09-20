import { useEffect, useRef, useState } from 'react';
import { saveLifeImage, deleteLifeImage, getLifeImage } from '@/db/repositories/lifeImageRepository';

interface MultiImagePickerProps {
  imageIds: string[];
  onChange: (newImageIds: string[]) => void;
  /** Caps how many photos can be added. Unlimited if omitted. */
  max?: number;
}

function Thumb({ id, onRemove }: { id: string; onRemove: () => void }) {
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    let objectUrl: string | undefined;
    let cancelled = false;
    getLifeImage(id).then((record) => {
      if (cancelled || !record) return;
      objectUrl = URL.createObjectURL(record.blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  return (
    <div className="relative w-20 h-20 shrink-0 rounded-2xl overflow-hidden bg-sand-100 border border-sand-200">
      {url && <img src={url} alt="" className="w-full h-full object-cover" />}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove photo"
        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-sand-900/70 text-white text-[10px] flex items-center justify-center"
      >
        ✕
      </button>
    </div>
  );
}

export default function MultiImagePicker({ imageIds, onChange, max }: MultiImagePickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const remainingSlots = typeof max === 'number' ? Math.max(0, max - imageIds.length) : undefined;

  const handleFiles = async (files: FileList) => {
    setUploading(true);
    const toAdd = remainingSlots !== undefined ? Array.from(files).slice(0, remainingSlots) : Array.from(files);
    const newIds: string[] = [];
    for (const file of toAdd) {
      newIds.push(await saveLifeImage(file));
    }
    onChange([...imageIds, ...newIds]);
    setUploading(false);
  };

  const removeAt = async (id: string) => {
    await deleteLifeImage(id);
    onChange(imageIds.filter((i) => i !== id));
  };

  const canAddMore = remainingSlots === undefined || remainingSlots > 0;

  return (
    <div>
      <label className="block text-xs font-semibold text-sand-900 mb-1.5">
        Photos{typeof max === 'number' ? ` (up to ${max})` : ''}
      </label>
      <div className="flex flex-wrap gap-2">
        {imageIds.map((id) => (
          <Thumb key={id} id={id} onRemove={() => removeAt(id)} />
        ))}
        {canAddMore && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-20 h-20 shrink-0 rounded-2xl border border-dashed border-sand-300 hover:border-sand-400 bg-sand-50 flex items-center justify-center text-sand-800/60 text-xs"
          >
            {uploading ? '…' : '+ Add'}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            e.target.value = '';
            if (files && files.length) handleFiles(files);
          }}
        />
      </div>
    </div>
  );
}
