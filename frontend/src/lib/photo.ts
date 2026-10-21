export async function resizePhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  });
  try {
    const ratio = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Nie udało się przygotować zdjęcia.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error('Nie udało się przygotować zdjęcia.')),
        'image/jpeg',
        0.85,
      ),
    );
    return new File([blob], 'zdjecie.jpg', { type: 'image/jpeg' });
  } finally {
    bitmap.close();
  }
}
