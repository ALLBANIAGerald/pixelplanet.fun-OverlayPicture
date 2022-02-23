
// ==UserScript==
// @name         pixelplanet.fun picture overlay
// @namespace    https://github.com/Woyken/pixelplanet.fun-OverlayPicture
// @version      1.1.0
// @description  Add your picture as overlay to pixelplanet.fun
// @author       Woyken
// @include      https://pixelplanet.fun/*
// @grant        none
// @downloadURL  https://woyken.github.io/pixelplanet.fun-OverlayPicture/pixelPlanetOverlay-loader.user.js
// ==/UserScript==
/**/

(function() {
  "use strict";
  {
    const e = document.createElement("script");
    e.src = "https://woyken.github.io/pixelplanet.fun-OverlayPicture/pixelPlanetOverlay.user.js";
    document.body.appendChild(e);
  }
})();
