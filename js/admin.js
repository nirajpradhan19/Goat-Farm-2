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
    return fetch("/api/images", { cache: "no-store" })
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

  // ==================== TABS ====================
  var loadedTabs = {};
  document.querySelectorAll(".admin-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".admin-tab").forEach(function (t) {
        t.classList.remove("active");
      });
      tab.classList.add("active");
      var target = tab.dataset.tab;
      document.querySelectorAll(".admin-tab-panel").forEach(function (panel) {
        panel.hidden = panel.id !== "tab-" + target;
      });
      if (!loadedTabs[target]) {
        loadedTabs[target] = true;
        if (target === "inventory") loadProducts();
        if (target === "orders") loadAdminOrders();
      }
    });
  });

  // ==================== INVENTORY ====================
  var products = [];
  var productEditor = document.getElementById("productEditor");
  var productEditorTitle = document.getElementById("productEditorTitle");
  var productTableWrap = document.getElementById("productTableWrap");
  var productTableBody = document.getElementById("productTableBody");
  var productsLoading = document.getElementById("productsLoading");
  var productError = document.getElementById("productError");

  function formatUsd(cents) {
    return "$" + (cents / 100).toFixed(2);
  }

  function openProductEditor(product) {
    productError.hidden = true;
    document.getElementById("productId").value = product ? product.id : "";
    document.getElementById("productName").value = product ? product.name : "";
    document.getElementById("productCategory").value = product ? product.category : "";
    document.getElementById("productPrice").value = product ? (product.price_cents / 100).toFixed(2) : "";
    document.getElementById("productStock").value = product ? product.stock : 0;
    document.getElementById("productDescription").value = product ? product.description : "";
    document.getElementById("productImageUrl").value = product ? product.image_url || "" : "";
    document.getElementById("productActive").value = product ? String(product.active) : "true";
    productEditorTitle.textContent = product ? "Edit Product" : "New Product";
    productEditor.hidden = false;
    productEditor.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  document.getElementById("newProductBtn").addEventListener("click", function () {
    openProductEditor(null);
  });
  document.getElementById("cancelProductBtn").addEventListener("click", function () {
    productEditor.hidden = true;
  });

  document.getElementById("saveProductBtn").addEventListener("click", function () {
    var id = document.getElementById("productId").value;
    var priceUsd = parseFloat(document.getElementById("productPrice").value);
    var payload = {
      name: document.getElementById("productName").value.trim(),
      category: document.getElementById("productCategory").value.trim() || "General",
      priceCents: Math.round((Number.isFinite(priceUsd) ? priceUsd : 0) * 100),
      stock: parseInt(document.getElementById("productStock").value, 10) || 0,
      description: document.getElementById("productDescription").value.trim(),
      imageUrl: document.getElementById("productImageUrl").value.trim() || null,
      active: document.getElementById("productActive").value === "true",
    };

    if (id) {
      payload.id = Number(id);
      payload.action = "update";
    } else {
      payload.action = "create";
    }

    productError.hidden = true;
    fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r.json().then(function (d) {
          return { ok: r.ok, data: d };
        });
      })
      .then(function (result) {
        if (result.ok) {
          productEditor.hidden = true;
          showBanner(id ? "Product updated." : "Product added.", "success");
          loadProducts();
        } else {
          productError.textContent = (result.data && result.data.error) || "Save failed";
          productError.hidden = false;
        }
      })
      .catch(function () {
        productError.textContent = "Network error — please try again.";
        productError.hidden = false;
      });
  });

  function renderProductTable() {
    productTableBody.innerHTML = "";
    products.forEach(function (p) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + p.name + "</td>" +
        "<td>" + p.category + "</td>" +
        "<td>" + formatUsd(p.price_cents) + "</td>" +
        "<td>" + p.stock + "</td>" +
        "<td>" + (p.active ? '<span class="active-badge">Active</span>' : '<span class="inactive-badge">Inactive</span>') + "</td>" +
        '<td><div class="row-actions">' +
        '<button type="button" class="btn btn-ghost btn-sm edit-product-btn">Edit</button>' +
        '<button type="button" class="btn btn-ghost btn-sm delete-product-btn">Delete</button>' +
        "</div></td>";
      tr.querySelector(".edit-product-btn").addEventListener("click", function () {
        openProductEditor(p);
      });
      tr.querySelector(".delete-product-btn").addEventListener("click", function () {
        if (!confirm('Delete "' + p.name + '"? Products used in past orders are deactivated instead of deleted.')) return;
        fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", id: p.id }),
        })
          .then(function (r) {
            return r.json();
          })
          .then(function () {
            loadProducts();
          });
      });
      productTableBody.appendChild(tr);
    });
  }

  function loadProducts() {
    productsLoading.hidden = false;
    productTableWrap.hidden = true;
    fetch("/api/products")
      .then(function (r) {
        return r.json().then(function (d) {
          return { ok: r.ok, data: d };
        });
      })
      .then(function (result) {
        productsLoading.hidden = true;
        if (result.ok) {
          products = result.data.products || [];
          productTableWrap.hidden = false;
          renderProductTable();
        } else {
          showBanner((result.data && result.data.error) || "Could not load products", "error");
        }
      })
      .catch(function () {
        productsLoading.hidden = true;
        showBanner("Network error loading products", "error");
      });
  }

  // ==================== ORDERS ====================
  var adminOrdersList = document.getElementById("adminOrdersList");
  var ordersLoadingAdmin = document.getElementById("ordersLoadingAdmin");
  var ordersEmptyAdmin = document.getElementById("ordersEmptyAdmin");
  var STATUSES = ["pending", "paid", "fulfilled", "cancelled"];

  function loadAdminOrders() {
    ordersLoadingAdmin.hidden = false;
    ordersEmptyAdmin.hidden = true;
    adminOrdersList.innerHTML = "";

    fetch("/api/admin-orders")
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        ordersLoadingAdmin.hidden = true;
        var orders = (data && data.orders) || [];
        if (orders.length === 0) {
          ordersEmptyAdmin.hidden = false;
          return;
        }
        orders.forEach(function (order) {
          var card = document.createElement("div");
          card.className = "order-card";
          var itemsLine = order.items.map((i) => i.quantity + "× " + i.product_name).join(", ");
          var who = order.user_name || order.user_email || order.customer_email || "Guest";

          var select = document.createElement("select");
          select.className = "order-status-select";
          STATUSES.forEach(function (s) {
            var opt = document.createElement("option");
            opt.value = s;
            opt.textContent = s;
            if (s === order.status) opt.selected = true;
            select.appendChild(opt);
          });
          select.addEventListener("change", function () {
            fetch("/api/admin-orders", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: order.id, status: select.value }),
            })
              .then(function (r) {
                return r.json();
              })
              .then(function (result) {
                if (result && result.ok) {
                  showBanner("Order #" + order.id + " marked " + select.value + ".", "success");
                } else {
                  showBanner((result && result.error) || "Update failed", "error");
                }
              });
          });

          card.innerHTML =
            '<div class="order-card-head">' +
            '<span class="order-id">Order #' + order.id + " — " + who + "</span>" +
            "</div>" +
            '<div class="order-date">' + new Date(order.created_at).toLocaleString() + "</div>" +
            '<div class="order-items-line" style="margin-top:10px;">' + itemsLine + "</div>" +
            '<div class="row" style="justify-content:space-between;margin-top:14px;">' +
            '<div class="order-total" style="margin:0;">' + formatUsd(order.total_cents) + "</div>" +
            "</div>";
          card.querySelector(".row").appendChild(select);
          adminOrdersList.appendChild(card);
        });
      })
      .catch(function () {
        ordersLoadingAdmin.hidden = true;
        showBanner("Network error loading orders", "error");
      });
  }

  function showLogin() {
    loginView.hidden = false;
    dashboardView.hidden = true;
    logoutBtn.hidden = true;
  }

  // ---- auth bootstrap ----
  fetch("/api/admin-auth")
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
    fetch("/api/admin-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", password: password })
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
    fetch("/api/admin-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" })
    }).finally(function () {
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
          return fetch("/api/images", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "upload", key: key, contentType: contentType, dataBase64: base64 })
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
      fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", key: key })
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
