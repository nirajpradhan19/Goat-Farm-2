/* Goat Hub — store page: product grid, filters, and cart panel */
(function () {
  "use strict";

  var products = [];
  var activeCategory = "all";

  var grid = document.getElementById("productGrid");
  var loadingEl = document.getElementById("storeLoading");
  var emptyEl = document.getElementById("storeEmpty");
  var filtersEl = document.getElementById("categoryFilters");

  var cartOverlay = document.getElementById("cartOverlay");
  var cartPanel = document.getElementById("cartPanel");
  var cartItemsEl = document.getElementById("cartItems");
  var cartEmptyMsg = document.getElementById("cartEmptyMsg");
  var cartSubtotalEl = document.getElementById("cartSubtotal");
  var checkoutBtn = document.getElementById("checkoutBtn");
  var checkoutError = document.getElementById("checkoutError");

  function formatPrice(cents) {
    return "$" + (cents / 100).toFixed(2);
  }

  function productById(id) {
    return products.find(function (p) {
      return p.id === id;
    });
  }

  function renderFilters() {
    var categories = Array.from(new Set(products.map((p) => p.category))).sort();
    if (categories.length <= 1) {
      filtersEl.hidden = true;
      return;
    }
    filtersEl.hidden = false;
    filtersEl.innerHTML = "";

    var allBtn = document.createElement("button");
    allBtn.className = "btn btn-sm " + (activeCategory === "all" ? "btn-forest" : "btn-ghost");
    allBtn.style.borderRadius = "50px";
    allBtn.textContent = "All";
    allBtn.addEventListener("click", function () {
      activeCategory = "all";
      renderFilters();
      renderGrid();
    });
    filtersEl.appendChild(allBtn);

    categories.forEach(function (cat) {
      var btn = document.createElement("button");
      btn.className = "btn btn-sm " + (activeCategory === cat ? "btn-forest" : "btn-ghost");
      btn.style.borderRadius = "50px";
      btn.textContent = cat;
      btn.addEventListener("click", function () {
        activeCategory = cat;
        renderFilters();
        renderGrid();
      });
      filtersEl.appendChild(btn);
    });
  }

  function renderGrid() {
    var visible = products.filter(function (p) {
      return activeCategory === "all" || p.category === activeCategory;
    });

    grid.innerHTML = "";
    visible.forEach(function (p) {
      var card = document.createElement("div");
      card.className = "product-card";

      var outOfStock = p.stock <= 0;
      var stockNote = outOfStock
        ? '<span class="out-badge">Sold Out</span>'
        : p.stock <= 5
        ? '<span class="stock-note low">Only ' + p.stock + " left</span>"
        : '<span class="stock-note">In stock</span>';

      card.innerHTML =
        '<div class="thumb"><img src="' + (p.image_url || "assets/svg/goat-standing-icon.svg") + '" alt="' + escapeHtml(p.name) + '"></div>' +
        '<div class="body">' +
        '<span class="cat">' + escapeHtml(p.category) + "</span>" +
        "<h3>" + escapeHtml(p.name) + "</h3>" +
        "<p>" + escapeHtml(p.description || "") + "</p>" +
        '<div class="price-row"><span class="price">' + formatPrice(p.price_cents) + "</span>" + stockNote + "</div>" +
        '<div class="add-row">' +
        (outOfStock
          ? '<button type="button" class="btn btn-ghost btn-sm" disabled style="flex:1;">Sold Out</button>'
          : '<input type="number" class="qty-input" min="1" max="' + p.stock + '" value="1">' +
            '<button type="button" class="btn btn-forest btn-sm add-btn" data-id="' + p.id + '">Add to Cart</button>') +
        "</div>" +
        "</div>";

      grid.appendChild(card);
    });

    grid.querySelectorAll(".add-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = Number(btn.dataset.id);
        var card = btn.closest(".product-card");
        var qtyInput = card.querySelector(".qty-input");
        var qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
        window.GoatHubCart.addToCart(id, qty);
        btn.textContent = "Added ✓";
        setTimeout(function () {
          btn.textContent = "Add to Cart";
        }, 1200);
      });
    });
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function loadProducts() {
    fetch("/api/products")
      .then(function (r) {
        return r.ok ? r.json() : { products: [] };
      })
      .then(function (data) {
        products = (data && data.products) || [];
        loadingEl.hidden = true;
        if (products.length === 0) {
          emptyEl.hidden = false;
        } else {
          grid.hidden = false;
          renderFilters();
          renderGrid();
        }
      })
      .catch(function () {
        loadingEl.hidden = true;
        emptyEl.hidden = false;
      });
  }

  // ---- cart panel ----
  function renderCartPanel() {
    var cart = window.GoatHubCart.getCart();
    cartItemsEl.innerHTML = "";
    var subtotal = 0;

    if (cart.length === 0) {
      cartEmptyMsg.hidden = false;
    } else {
      cartEmptyMsg.hidden = true;
      cart.forEach(function (item) {
        var product = productById(item.productId);
        if (!product) return; // product no longer exists/active
        var lineTotal = product.price_cents * item.quantity;
        subtotal += lineTotal;

        var line = document.createElement("div");
        line.className = "cart-line";
        line.innerHTML =
          '<div class="thumb"><img src="' + (product.image_url || "assets/svg/goat-standing-icon.svg") + '" alt=""></div>' +
          '<div class="info">' +
          "<h4>" + escapeHtml(product.name) + "</h4>" +
          '<div class="unit-price">' + formatPrice(product.price_cents) + " each</div>" +
          '<div class="qty-row">' +
          '<button type="button" class="qty-dec" data-id="' + product.id + '">−</button>' +
          "<span>" + item.quantity + "</span>" +
          '<button type="button" class="qty-inc" data-id="' + product.id + '">+</button>' +
          "</div>" +
          '<button type="button" class="remove-btn" data-id="' + product.id + '">Remove</button>' +
          "</div>" +
          '<div class="line-total">' + formatPrice(lineTotal) + "</div>";
        cartItemsEl.appendChild(line);
      });
    }

    cartSubtotalEl.textContent = formatPrice(subtotal);

    cartItemsEl.querySelectorAll(".qty-inc").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = Number(btn.dataset.id);
        var product = productById(id);
        var current = window.GoatHubCart.getCart().find((i) => i.productId === id);
        var next = (current ? current.quantity : 0) + 1;
        if (product && next > product.stock) return;
        window.GoatHubCart.setQuantity(id, next);
        renderCartPanel();
      });
    });
    cartItemsEl.querySelectorAll(".qty-dec").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = Number(btn.dataset.id);
        var current = window.GoatHubCart.getCart().find((i) => i.productId === id);
        var next = (current ? current.quantity : 1) - 1;
        window.GoatHubCart.setQuantity(id, next);
        renderCartPanel();
      });
    });
    cartItemsEl.querySelectorAll(".remove-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        window.GoatHubCart.removeFromCart(Number(btn.dataset.id));
        renderCartPanel();
      });
    });
  }

  function openCart() {
    renderCartPanel();
    cartOverlay.hidden = false;
    cartPanel.hidden = false;
    checkoutError.hidden = true;
  }
  function closeCart() {
    cartOverlay.hidden = true;
    cartPanel.hidden = true;
  }

  document.getElementById("openCartBtn").addEventListener("click", openCart);
  document.getElementById("closeCartBtn").addEventListener("click", closeCart);
  cartOverlay.addEventListener("click", closeCart);

  checkoutBtn.addEventListener("click", function () {
    var cart = window.GoatHubCart.getCart();
    if (cart.length === 0) return;

    checkoutError.hidden = true;
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = "Please wait…";

    fetch("/api/auth/me")
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (!data || !data.user) {
          window.location.href = "account.html?next=checkout";
          return;
        }
        return fetch("/api/orders/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: cart }),
        })
          .then(function (r) {
            return r.json().then(function (d) {
              return { ok: r.ok, data: d };
            });
          })
          .then(function (result) {
            if (result.ok && result.data.url) {
              window.location.href = result.data.url;
            } else {
              checkoutError.textContent = (result.data && result.data.error) || "Checkout failed";
              checkoutError.hidden = false;
              checkoutBtn.disabled = false;
              checkoutBtn.textContent = "Checkout";
            }
          });
      })
      .catch(function () {
        checkoutError.textContent = "Network error — please try again.";
        checkoutError.hidden = false;
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = "Checkout";
      });
  });

  if (new URLSearchParams(window.location.search).get("order") === "cancelled") {
    var banner = document.getElementById("storeBanner");
    banner.textContent = "Checkout was cancelled — your cart is still here.";
    banner.hidden = false;
  }

  loadProducts();
})();
