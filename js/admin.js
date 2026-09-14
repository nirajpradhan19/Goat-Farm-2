/* Goat Hub — image admin panel */
(function () {
  "use strict";

  var MAX_BYTES = 3 * 1024 * 1024; // must match api/images/upload.js
  var ACCEPTED_TYPES = ["image/svg+xml", "image/png", "image/jpeg", "image/webp", "image/gif"];

  // Mirrors api/_lib/imageKeys.js, with human-friendly labels for the UI.
  var IMAGES = [
    { key: "logo", label: "Site Logo", category: "Branding", defaultSrc: "assets/img/logo-goathub.png" },
    { key: "favicon", label: "Favicon", category: "Branding", defaultSrc: "assets/svg/favicon.svg" },
    { key: "logo-seal", label: "About Page Seal", category: "Branding", defaultSrc: "assets/svg/logo-goathub.svg" },
    { key: "hero-goat", label: "Homepage Hero", category: "Home", defaultSrc: "assets/svg/hero-goat.svg" },
    { key: "about-goats", label: "About / Story Image", category: "Home", defaultSrc: "assets/svg/about-goats.svg" },
    { key: "goat-standing-icon", label: "Breed Card Icon (used ×6)", category: "Breeds", defaultSrc: "assets/svg/goat-standing-icon.svg" },
    { key: "goat-standing-card", label: "\"Meet The Herd\" Spotlight", category: "About", defaultSrc: "assets/svg/goat-standing-card.svg" },
    { key: "gallery-1", label: "Gallery Photo 1 — Morning Grazing", category: "Gallery", defaultSrc: "assets/svg/gallery-1.svg" },
    { key: "gallery-2", label: "Gallery Photo 2 — Kidding Season", category: "Gallery", defaultSrc: "assets/svg/gallery-2.svg" },
    { key: "gallery-3", label: "Gallery Photo 3 — Milking Time", category: "Gallery", defaultSrc: "assets/svg/gallery-3.svg" },
    { key: "gallery-4", label: "Gallery Photo 4 — Ridge Pasture", category: "Gallery", defaultSrc: "assets/svg/gallery-4.svg" },
    { key: "gallery-5", label: "Gallery Photo 5 — Cheese Making", category: "Gallery", defaultSrc: "assets/svg/gallery-5.svg" },
    { key: "gallery-6", label: "Gallery Photo 6 — Evening Herd", category: "Gallery", defaultSrc: "assets/svg/gallery-6.svg" },
    { key: "blog-1", label: "Journal Thumbnail — Nutrition", category: "Journal", defaultSrc: "assets/svg/blog-1.svg" },
    { key: "blog-2", label: "Journal Thumbnail — Health", category: "Journal", defaultSrc: "assets/svg/blog-2.svg" },
    { key: "blog-3", label: "Journal Thumbnail — Sustainability", category: "Journal", defaultSrc: "assets/svg/blog-3.svg" },
    { key: "team-1", label: "Team Portrait — Eleanor", category: "About", defaultSrc: "assets/svg/team-1.svg" },
    { key: "team-2", label: "Team Portrait — Priya", category: "About", defaultSrc: "assets/svg/team-2.svg" },
    { key: "team-3", label: "Team Portrait — Sam", category: "About", defaultSrc: "assets/svg/team-3.svg" },
    { key: "map", label: "Contact Page Map", category: "Contact", defaultSrc: "assets/svg/map.svg" }
  ];

  var loginView = document.getElementById("loginView");
  var dashboardView = document.getElementById("dashboardView");
  var loginForm = document.getElementById("loginForm");
  var loginError = document.getElementById("loginError");
  var logoutBtn = document.getElementById("logoutBtn");
  var grid = document.getElementById("imageGrid");
  var banner = document.getElementById("statusBanner");

  var manifest = {};

  function showBanner(message, type) {
    banner.textContent = message;
    banner.className = "admin-banner " + type;
    banner.hidden = false;
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = reader.result || "";
        var comma = result.indexOf(",");
        resolve(comma === -1 ? result : result.slice(comma + 1));
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderGrid() {
    grid.innerHTML = "";
    IMAGES.forEach(function (img) {
      var isCustom = Boolean(manifest[img.key]);
      var src = manifest[img.key] || img.defaultSrc;

      var card = document.createElement("div");
      card.className = "admin-card";
      card.dataset.key = img.key;

      card.innerHTML =
        '<div class="thumb"><img src="' + src + '" alt=""></div>' +
        '<div><span class="cat">' + img.category + "</span><h3>" + img.label + "</h3></div>" +
        (isCustom ? '<span class="custom-tag">● Customized</span>' : "") +
        '<div class="row"><input type="file" accept=".svg,.png,.jpg,.jpeg,.webp,.gif,image/*"></div>' +
        '<p class="card-msg"></p>' +
        '<div class="card-actions">' +
        '<button type="button" class="btn btn-forest btn-sm upload-btn">Upload</button>' +
        (isCustom ? '<button type="button" class="btn btn-ghost btn-sm reset-btn">Reset</button>' : "") +
        "</div>";

      grid.appendChild(card);
    });
  }

  function setCardMessage(card, text, type) {
    var msg = card.querySelector(".card-msg");
    msg.textContent = text || "";
    msg.className = "card-msg" + (type ? " " + type : "");
  }

  function loadManifest() {
    return fetch("/api/images/manifest", { cache: "no-store" })
      .then(function (r) {
        return r.ok ? r.json() : {};
      })
      .then(function (data) {
        manifest = data || {};
      })
      .catch(function () {
        manifest = {};
      });
  }

  function showDashboard() {
    loginView.hidden = true;
    dashboardView.hidden = false;
    logoutBtn.hidden = false;
    loadManifest().then(renderGrid);
  }

  function showLogin() {
    loginView.hidden = false;
    dashboardView.hidden = true;
    logoutBtn.hidden = true;
  }

  // ---- auth bootstrap ----
  fetch("/api/check-auth")
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      if (data && data.authenticated) {
        showDashboard();
      } else {
        showLogin();
      }
    })
    .catch(function () {
      showLogin();
    });

  // ---- login ----
  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    loginError.hidden = true;
    var password = document.getElementById("password").value;
    fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: password })
    })
      .then(function (r) {
        return r.json().then(function (data) {
          return { ok: r.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok) {
          showDashboard();
        } else {
          loginError.textContent = (result.data && result.data.error) || "Login failed";
          loginError.hidden = false;
        }
      })
      .catch(function () {
        loginError.textContent = "Network error — please try again.";
        loginError.hidden = false;
      });
  });

  // ---- logout ----
  logoutBtn.addEventListener("click", function () {
    fetch("/api/logout", { method: "POST" }).finally(function () {
      showLogin();
    });
  });

  // ---- upload / reset (delegated) ----
  grid.addEventListener("click", function (e) {
    var card = e.target.closest(".admin-card");
    if (!card) return;
    var key = card.dataset.key;

    if (e.target.classList.contains("upload-btn")) {
      var fileInput = card.querySelector('input[type="file"]');
      var file = fileInput.files && fileInput.files[0];
      if (!file) {
        setCardMessage(card, "Choose a file first", "error");
        return;
      }
      if (file.size > MAX_BYTES) {
        setCardMessage(card, "File is too large (max 3MB)", "error");
        return;
      }
      var contentType = file.type;
      if (ACCEPTED_TYPES.indexOf(contentType) === -1) {
        setCardMessage(card, "Unsupported file type", "error");
        return;
      }

      card.classList.add("busy");
      setCardMessage(card, "Uploading…");
      fileToBase64(file)
        .then(function (base64) {
          return fetch("/api/images/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: key, contentType: contentType, dataBase64: base64 })
          });
        })
        .then(function (r) {
          return r.json().then(function (data) {
            return { ok: r.ok, data: data };
          });
        })
        .then(function (result) {
          card.classList.remove("busy");
          if (result.ok) {
            manifest[key] = result.data.url;
            setCardMessage(card, "Updated ✓", "success");
            showBanner("Image updated — live for everyone now.", "success");
            renderGrid();
          } else {
            setCardMessage(card, (result.data && result.data.error) || "Upload failed", "error");
          }
        })
        .catch(function () {
          card.classList.remove("busy");
          setCardMessage(card, "Network error", "error");
        });
    }

    if (e.target.classList.contains("reset-btn")) {
      card.classList.add("busy");
      setCardMessage(card, "Resetting…");
      fetch("/api/images/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key })
      })
        .then(function (r) {
          return r.json().then(function (data) {
            return { ok: r.ok, data: data };
          });
        })
        .then(function (result) {
          card.classList.remove("busy");
          if (result.ok) {
            delete manifest[key];
            showBanner("Reverted to the default image.", "success");
            renderGrid();
          } else {
            setCardMessage(card, (result.data && result.data.error) || "Reset failed", "error");
          }
        })
        .catch(function () {
          card.classList.remove("busy");
          setCardMessage(card, "Network error", "error");
        });
    }
  });
})();
