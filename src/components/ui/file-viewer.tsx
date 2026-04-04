"use client";

import { useState, useEffect, useCallback } from "react";

interface FileViewerProps {
  /** The signed URL or data URL for the file */
  src: string;
  /** Whether the file is a PDF */
  isPdf?: boolean;
  /** Alt text for images */
  alt?: string;
  /** Thumbnail size class, e.g. "w-10 h-10" */
  thumbnailClass?: string;
}

export function FileThumbnail({
  src,
  isPdf,
  alt = "תמונת הסמכה",
  thumbnailClass = "w-10 h-10",
}: FileViewerProps) {
  const [open, setOpen] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    },
    []
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!src) return null;

  return (
    <>
      {/* Thumbnail */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${thumbnailClass} rounded-lg border border-gray-200 overflow-hidden flex-shrink-0 bg-gray-50 hover:ring-2 hover:ring-blue-400 transition-all cursor-pointer`}
      >
        {isPdf ? (
          <div className="w-full h-full flex items-center justify-center bg-red-50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-cover"
          />
        )}
      </button>

      {/* Lightbox overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-4 left-4 z-10 rounded-full bg-white/90 p-2 shadow-lg hover:bg-white transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-gray-800"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Download link */}
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute top-4 right-4 z-10 rounded-full bg-white/90 p-2 shadow-lg hover:bg-white transition-colors"
            title="פתח בחלון חדש"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-gray-800"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>

          {/* Content */}
          <div
            className="max-w-4xl max-h-[85vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {isPdf ? (
              <iframe
                src={src}
                className="w-full h-[85vh] rounded-lg bg-white"
                title="תצוגת PDF"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={src}
                alt={alt}
                className="max-w-full max-h-[85vh] mx-auto rounded-lg object-contain"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
