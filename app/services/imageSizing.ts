export class ImageSizing {
  static getImageSize(
    minWidth: number,
    viewWidth: number,
    imageCount: number,
    maxSize = 210,
    padding = 8
  ): number {
    let maxImagesPerRow = Math.floor(viewWidth / minWidth);
    if (maxImagesPerRow > imageCount) {
      maxImagesPerRow = imageCount;
    }
    let imageSize = Math.floor(viewWidth / maxImagesPerRow);
    if (imageSize > maxSize) {
      imageSize = maxSize;
    }
    const reduction = (padding * (maxImagesPerRow - 1)) / maxImagesPerRow;
    return imageSize - reduction;
  }
}
