/*
 * Browser-side digit recognition.
 *
 * Two paths, deliberately separated:
 *
 *   predictFromPixels(pixels)  a 28x28 array already in MNIST form. Applies
 *                              the same deskew + /255 the Python pipeline
 *                              applies, then runs the network. This is the
 *                              path the parity test exercises against
 *                              scikit-learn's own predictions.
 *
 *   canvasToMnist(canvas)      turns a free drawing into MNIST form first:
 *                              crop to ink, scale the long side to 20px, and
 *                              centre by centre of mass in a 28x28 frame.
 *                              This is how MNIST itself was built, and without
 *                              it a hand-drawn digit sits nothing like the
 *                              training data and the model guesses badly.
 *
 * Weights come from model.js as int8 codes plus a scale per layer.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.DigitRecognizer = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var SIZE = 28;
  var cache = null;

  function decodeBase64(text) {
    if (typeof Buffer !== "undefined") {
      return new Int8Array(Buffer.from(text, "base64"));
    }
    var binary = atob(text);
    var bytes = new Int8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = (binary.charCodeAt(i) << 24) >> 24; // to signed
    }
    return bytes;
  }

  function loadWeights(model) {
    if (cache && cache.model === model) return cache;
    cache = {
      model: model,
      W1: decodeBase64(model.W1),
      W2: decodeBase64(model.W2),
      b1: model.b1,
      b2: model.b2
    };
    return cache;
  }

  /* Mirror of src/digits/preprocess.py :: deskew
     scipy computes output[i][j] = input[i][ j + skew * (i - rows/2) ]
     with bilinear interpolation and zeros outside the frame. */
  function deskew(image) {
    var total = 0, i, j, value;
    for (i = 0; i < SIZE; i++) {
      for (j = 0; j < SIZE; j++) total += image[i][j];
    }
    if (total === 0) return image;

    var meanX = 0, meanY = 0;
    for (i = 0; i < SIZE; i++) {
      for (j = 0; j < SIZE; j++) {
        value = image[i][j];
        meanX += j * value;
        meanY += i * value;
      }
    }
    meanX /= total;
    meanY /= total;

    var varY = 0, covXY = 0;
    for (i = 0; i < SIZE; i++) {
      for (j = 0; j < SIZE; j++) {
        value = image[i][j];
        varY += (i - meanY) * (i - meanY) * value;
        covXY += (j - meanX) * (i - meanY) * value;
      }
    }
    varY /= total;
    covXY /= total;
    if (varY < 1e-6) return image;

    var skew = covXY / varY;
    var output = [];
    for (i = 0; i < SIZE; i++) {
      output.push(new Float64Array(SIZE));
      var sourceShift = skew * i - skew * (SIZE / 2.0);
      for (j = 0; j < SIZE; j++) {
        var x = j + sourceShift;
        if (x <= -1 || x >= SIZE) { output[i][j] = 0; continue; }
        var x0 = Math.floor(x);
        var dx = x - x0;
        var left = (x0 >= 0 && x0 < SIZE) ? image[i][x0] : 0;
        var right = (x0 + 1 >= 0 && x0 + 1 < SIZE) ? image[i][x0 + 1] : 0;
        output[i][j] = left * (1 - dx) + right * dx;
      }
    }
    return output;
  }

  function toMatrix(flatOrNested) {
    if (Array.isArray(flatOrNested[0]) || ArrayBuffer.isView(flatOrNested[0])) {
      return flatOrNested;
    }
    var matrix = [];
    for (var i = 0; i < SIZE; i++) {
      matrix.push(Array.prototype.slice.call(flatOrNested, i * SIZE, (i + 1) * SIZE));
    }
    return matrix;
  }

  function forward(vector, model) {
    var weights = loadWeights(model);
    var inputSize = model.input_size;
    var hiddenSize = model.hidden_size;
    var classCount = model.classes.length;

    var hidden = new Float64Array(hiddenSize);
    var h, k, sum;
    for (h = 0; h < hiddenSize; h++) hidden[h] = weights.b1[h];
    for (k = 0; k < inputSize; k++) {
      var pixel = vector[k];
      if (pixel === 0) continue;               // ~80% of MNIST pixels are zero
      var offset = k * hiddenSize;
      for (h = 0; h < hiddenSize; h++) {
        hidden[h] += pixel * weights.W1[offset + h] * model.scale1;
      }
    }
    for (h = 0; h < hiddenSize; h++) {
      if (hidden[h] < 0) hidden[h] = 0;        // ReLU
    }

    var logits = new Float64Array(classCount);
    for (var c = 0; c < classCount; c++) {
      sum = weights.b2[c];
      for (h = 0; h < hiddenSize; h++) {
        sum += hidden[h] * weights.W2[h * classCount + c] * model.scale2;
      }
      logits[c] = sum;
    }

    var max = -Infinity;
    for (c = 0; c < classCount; c++) max = Math.max(max, logits[c]);
    var totalExp = 0;
    var probabilities = new Array(classCount);
    for (c = 0; c < classCount; c++) {
      probabilities[c] = Math.exp(logits[c] - max);
      totalExp += probabilities[c];
    }
    for (c = 0; c < classCount; c++) probabilities[c] /= totalExp;
    return probabilities;
  }

  function predictFromPixels(pixels, model) {
    model = model || (typeof window !== "undefined" ? window.DIGIT_MODEL : null);
    if (!model) throw new Error("model not loaded");

    var processed = deskew(toMatrix(pixels));
    var vector = new Float64Array(SIZE * SIZE);
    for (var i = 0; i < SIZE; i++) {
      for (var j = 0; j < SIZE; j++) {
        var v = processed[i][j];
        if (v < 0) v = 0; else if (v > 255) v = 255;
        vector[i * SIZE + j] = v / 255.0;
      }
    }
    var probabilities = forward(vector, model);
    var best = 0;
    for (var c = 1; c < probabilities.length; c++) {
      if (probabilities[c] > probabilities[best]) best = c;
    }
    return {
      digit: model.classes[best],
      confidence: probabilities[best],
      probabilities: probabilities
    };
  }

  /* MNIST-style normalisation of a free drawing. */
  function canvasToMnist(sourceCanvas) {
    var size = sourceCanvas.width;
    var context = sourceCanvas.getContext("2d");
    var data = context.getImageData(0, 0, size, size).data;

    // Ink intensity: the canvas draws white on black already.
    var ink = new Float64Array(size * size);
    var minX = size, minY = size, maxX = -1, maxY = -1;
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var alpha = data[(y * size + x) * 4 + 3];
        var value = data[(y * size + x) * 4] * (alpha / 255);
        ink[y * size + x] = value;
        if (value > 25) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null; // nothing drawn

    var boxWidth = maxX - minX + 1;
    var boxHeight = maxY - minY + 1;
    var longest = Math.max(boxWidth, boxHeight);
    var scale = 20 / longest;               // MNIST fits digits in a 20px box
    var targetWidth = Math.max(1, Math.round(boxWidth * scale));
    var targetHeight = Math.max(1, Math.round(boxHeight * scale));

    // Box-filter downsample of the cropped region.
    var small = [];
    for (var ty = 0; ty < targetHeight; ty++) {
      small.push(new Float64Array(targetWidth));
      for (var tx = 0; tx < targetWidth; tx++) {
        var sx0 = minX + Math.floor(tx * boxWidth / targetWidth);
        var sx1 = minX + Math.max(sx0 + 1 - minX, Math.floor((tx + 1) * boxWidth / targetWidth));
        var sy0 = minY + Math.floor(ty * boxHeight / targetHeight);
        var sy1 = minY + Math.max(sy0 + 1 - minY, Math.floor((ty + 1) * boxHeight / targetHeight));
        var sum = 0, count = 0;
        for (var sy = sy0; sy < sy1 && sy <= maxY; sy++) {
          for (var sx = sx0; sx < sx1 && sx <= maxX; sx++) {
            sum += ink[sy * size + sx];
            count++;
          }
        }
        small[ty][tx] = count ? sum / count : 0;
      }
    }

    // Centre of mass of the shrunk digit, then paste into a 28x28 frame.
    var mass = 0, comX = 0, comY = 0;
    for (ty = 0; ty < targetHeight; ty++) {
      for (tx = 0; tx < targetWidth; tx++) {
        var m = small[ty][tx];
        mass += m; comX += tx * m; comY += ty * m;
      }
    }
    if (mass === 0) return null;
    comX /= mass; comY /= mass;

    var frame = [];
    for (var i = 0; i < SIZE; i++) frame.push(new Float64Array(SIZE));
    var originX = Math.round(SIZE / 2 - comX);
    var originY = Math.round(SIZE / 2 - comY);
    for (ty = 0; ty < targetHeight; ty++) {
      for (tx = 0; tx < targetWidth; tx++) {
        var fx = originX + tx, fy = originY + ty;
        if (fx >= 0 && fx < SIZE && fy >= 0 && fy < SIZE) {
          frame[fy][fx] = small[ty][tx];
        }
      }
    }
    return frame;
  }

  return {
    SIZE: SIZE,
    deskew: deskew,
    forward: forward,
    predictFromPixels: predictFromPixels,
    canvasToMnist: canvasToMnist
  };
});
