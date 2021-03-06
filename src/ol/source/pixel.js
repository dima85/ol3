goog.provide('ol.source.Pixel');

goog.require('ol');
goog.require('ol.ImageTile');
goog.require('ol.Tile');
goog.require('ol.asserts');
goog.require('ol.dom');
goog.require('ol.extent');
goog.require('ol.source.TileImage');
goog.require('ol.tilegrid.TileGrid');


/**
 * @enum {string}
 */
ol.source.PixelTierSizeCalculation = {
  DEFAULT: 'default',
  TRUNCATED: 'truncated'
};


/**
 * @classdesc
 * Layer source for tile data in Pixel format.
 *
 * @constructor
 * @extends {ol.source.TileImage}
 * @param {olx.source.PixelOptions=} opt_options Options.
 * @api stable
 */
ol.source.Pixel = function(opt_options) {

  var options = opt_options || {};

  var size = options.size;
  var tierSizeCalculation = options.tierSizeCalculation !== undefined ?
      options.tierSizeCalculation :
      ol.source.PixelTierSizeCalculation.DEFAULT;

  var imageWidth = size[0];
  var imageHeight = size[1];
  var tierSizeInTiles = [];
  var tileSize = ol.DEFAULT_TILE_SIZE;

  switch (tierSizeCalculation) {
    case ol.source.PixelTierSizeCalculation.DEFAULT:
      while (imageWidth > tileSize || imageHeight > tileSize) {
        tierSizeInTiles.push([
          Math.ceil(imageWidth / tileSize),
          Math.ceil(imageHeight / tileSize)
        ]);
        tileSize += tileSize;
      }
      break;
    case ol.source.PixelTierSizeCalculation.TRUNCATED:
      var width = imageWidth;
      var height = imageHeight;
      while (width > tileSize || height > tileSize) {
        tierSizeInTiles.push([
          Math.ceil(width / tileSize),
          Math.ceil(height / tileSize)
        ]);
        width >>= 1;
        height >>= 1;
      }
      break;
    default:
      ol.asserts.assert(false, 53); // Unknown `tierSizeCalculation` configured
      break;
  }

  tierSizeInTiles.push([1, 1]);
  tierSizeInTiles.reverse();

  var resolutions = [1];
  var tileCountUpToTier = [0];
  var i, ii;
  for (i = 1, ii = tierSizeInTiles.length; i < ii; i++) {
    resolutions.push(1 << i);
    tileCountUpToTier.push(
        tierSizeInTiles[i - 1][0] * tierSizeInTiles[i - 1][1] +
        tileCountUpToTier[i - 1]
    );
  }
  resolutions.reverse();

  var extent = [0, -size[1], size[0], 0];
  var tileGrid = new ol.tilegrid.TileGrid({
    extent: extent,
    origin: ol.extent.getTopLeft(extent),
    resolutions: resolutions
  });

  var url = options.url;
  var urlFunction = options.tileUrlFunction;
  /**
   * @this {ol.source.TileImage}
   * @param {ol.TileCoord} tileCoord Tile Coordinate.
   * @param {number} pixelRatio Pixel ratio.
   * @param {ol.proj.Projection} projection Projection.
   * @return {string|undefined} Tile URL.
   */
  function tileUrlFunction(tileCoord, pixelRatio, projection) {
    if (!tileCoord) {
      return undefined;
    } else {
      return urlFunction(tileCoord, pixelRatio, projection);
    }
  }

  ol.source.TileImage.call(this, {
    attributions: options.attributions,
    cacheSize: options.cacheSize,
    crossOrigin: options.crossOrigin,
    logo: options.logo,
    reprojectionErrorThreshold: options.reprojectionErrorThreshold,
    tileClass: ol.source.PixelTile_,
    tileGrid: tileGrid,
    tileUrlFunction: tileUrlFunction
  });

};
ol.inherits(ol.source.Pixel, ol.source.TileImage);


/**
 * @constructor
 * @extends {ol.ImageTile}
 * @param {ol.TileCoord} tileCoord Tile coordinate.
 * @param {ol.Tile.State} state State.
 * @param {string} src Image source URI.
 * @param {?string} crossOrigin Cross origin.
 * @param {ol.TileLoadFunctionType} tileLoadFunction Tile load function.
 * @private
 */
ol.source.PixelTile_ = function(
    tileCoord, state, src, crossOrigin, tileLoadFunction) {

  ol.ImageTile.call(this, tileCoord, state, src, crossOrigin, tileLoadFunction);

  /**
   * @private
   * @type {Object.<string,
   *                HTMLCanvasElement|HTMLImageElement|HTMLVideoElement>}
   */
  this.pixelImageByContext_ = {};

};
ol.inherits(ol.source.PixelTile_, ol.ImageTile);


/**
 * @inheritDoc
 */
ol.source.PixelTile_.prototype.getImage = function(opt_context) {
  var tileSize = ol.DEFAULT_TILE_SIZE;
  var key = opt_context !== undefined ?
      ol.getUid(opt_context).toString() : '';
  if (key in this.pixelImageByContext_) {
    return this.pixelImageByContext_[key];
  } else {
    var image = ol.ImageTile.prototype.getImage.call(this, opt_context);
    if (this.state == ol.Tile.State.LOADED) {
      if (image.width == tileSize && image.height == tileSize) {
        this.pixelImageByContext_[key] = image;
        return image;
      } else {
        var context = ol.dom.createCanvasContext2D(tileSize, tileSize);
        context.drawImage(image, 0, 0);
        this.pixelImageByContext_[key] = context.canvas;
        return context.canvas;
      }
    } else {
      return image;
    }
  }
};
