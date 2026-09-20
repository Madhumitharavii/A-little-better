import { useEffect, useState } from 'react';
import { getLifeImage } from '@/db/repositories/lifeImageRepository';

/**
 * Resolves a lifeImages id to a displayable object URL. Deliberately
 * NOT a liveQuery — object URLs must be created/revoked exactly once
 * per blob, so this uses a plain effect keyed on the id instead.
 */
export function useLifeImageUrl(imageId: string | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!imageId) {
      setUrl(undefined);
      return;
    }
    let objectUrl: string | undefined;
    let cancelled = false;

    getLifeImage(imageId).then((record) => {
      if (cancelled || !record) return;
      objectUrl = URL.createObjectURL(record.blob);
      setUrl(objectUrl);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageId]);

  return url;
}
