'use strict';

if (document.body.dataset.page === 'train') {
  require('./webgl-training').bindWebGLTraining();
} else {
  require('./inference-browser').bindInference();
}
