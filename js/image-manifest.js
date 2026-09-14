/* Goat Hub — applies any admin-replaced images on top of the bundled
   defaults. If this fails for any reason (network, no Blob store set up
   yet, JS disabled), every image already has a working default `src` in
   the HTML, so the page never depends on this succeeding. */
(function () {
  "use strict";

  fetch("/api/images/manifest", { cache: "no-store" })
    .then(function (r) {
      return r.ok ? r.json() : {};
    })
    .then(function (manifest) {
      if (!manifest || typeof manifest !== "object") return;

      if (manifest.favicon) {
        var iconLink = document.querySelector('link[rel="icon"]');
        if (iconLink) iconLink.href = manifest.favicon;
      }

      document.querySelectorAll("[data-image-key]").forEach(function (el) {
        var key = el.getAttribute("data-image-key");
        if (manifest[key]) {
          el.src = manifest[key];
        }
      });
    })
    .catch(function () {
      /* keep bundled defaults */
    });
})();
