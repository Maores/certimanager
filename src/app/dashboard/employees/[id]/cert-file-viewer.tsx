"use client";

import { FileThumbnail } from "@/components/ui/file-viewer";

interface CertFileViewerProps {
  src: string;
  isPdf: boolean;
}

export function CertFileViewer({ src, isPdf }: CertFileViewerProps) {
  return (
    <FileThumbnail
      src={src}
      isPdf={isPdf}
      alt="קובץ הסמכה"
      thumbnailClass="w-12 h-12"
    />
  );
}
