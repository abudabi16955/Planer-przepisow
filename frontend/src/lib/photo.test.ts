import { afterEach, expect, test, vi } from 'vitest';
import { resizePhoto } from './photo';
afterEach(() => vi.restoreAllMocks());
test.each([
  [4000, 3000, 2000, 1500],
  [1000, 500, 1000, 500],
  [1000, 4000, 500, 2000],
])(
  'zmniejsza %s×%s do %s×%s i zwalnia bitmapę',
  async (width, height, w, h) => {
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width, height, close })),
    );
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect: vi.fn(),
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      function (callback) {
        callback(new Blob(['photo'], { type: 'image/jpeg' }));
      },
    );
    const result = await resizePhoto(new File(['original'], 'big.jpg'));
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, w, h);
    expect(result.type).toBe('image/jpeg');
    expect(close).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  },
);
