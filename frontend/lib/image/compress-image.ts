"use client";

type CompressOptions = {
  maxWidth?: number;
  quality?: number;
};

const DEFAULT_MAX_WIDTH = 1280;
const DEFAULT_QUALITY = 0.7;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = src;
  });
}

function blobToFile(blob: Blob, originalName: string) {
  const baseName = originalName.replace(/\.[^.]+$/, "");
  const fileName = `${baseName || "poster"}-compressed.jpg`;
  return new File([blob], fileName, { type: "image/jpeg" });
}

export async function compressImageToJpeg(
  file: File,
  options: CompressOptions = {},
): Promise<File> {
  const maxWidth = options.maxWidth ?? DEFAULT_MAX_WIDTH;
  const quality = options.quality ?? DEFAULT_QUALITY;

  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);

  const scale =
    image.width > maxWidth ? maxWidth / image.width : 1;
  const targetWidth = Math.round(image.width * scale);
  const targetHeight = Math.round(image.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas not supported");
  }
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error("Failed to compress image"));
          return;
        }
        resolve(result);
      },
      "image/jpeg",
      quality,
    );
  });

  return blobToFile(blob, file.name);
}

