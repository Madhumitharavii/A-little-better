import { useRef, useState } from 'react';
import { saveLifeImage, deleteLifeImage } from '@/db/repositories/lifeImageRepository';
import { useLifeImageUrl } from '@/shared/hooks/useLifeImageUrl';

interface ImagePickerProps {
  imageId: string | undefined;
  onChange: (newImageId: string | undefined) => void;
  label?: string;
  aspectClassName?: string;
}

export default function ImagePicker({ imageId, onChange, label = 'Add a photo', aspectClassName = 'aspect-square' }: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const previewUrl = useLifeImageUrl(imageId);

  const handleFile = async (file: File) => {
    setUploading(true);
    const oldId = imageId;
    const newId = await saveLifeImage(file);
    onChange(newId);
    if (oldId) await deleteLifeImage(oldId);
    setUploading(false);
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-sand-900 mb-1.5">{label}</label>
      <div
        className={`relative w-full ${aspectClassName} bg-sand-50 border border-dashed border-sand-300 rounded-2xl overflow-hidden flex items-center justify-center cursor-pointer hover:border-sand-400 transition-colors`}
        onClick={() => inputRef.current?.click()}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="text-center px-4">
            <span className="text-2xl block mb-1">📷</span>
            <span className="text-[11px] text-sand-800/60">{uploading ? 'Saving…' : 'Tap to choose a photo'}</span>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) handleFile(file);
          }}
        />
      </div>
      {imageId && (
        <button
          type="button"
          onClick={async () => {
            await deleteLifeImage(imageId);
            onChange(undefined);
          }}
          className="mt-2 text-[11px] text-sand-800/60 hover:text-terracotta-600 underline"
        >
          Remove photo
        </button>
      )}
    </div>
  );
}
