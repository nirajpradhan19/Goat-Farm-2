/* Goat Hub — shared cart state (localStorage) + header badge.
   Cart only stores {productId, quantity} pairs; price/name always come
   fresh from /api/products so the cart can never show a stale price. */
(function () {
  "use strict";

  var STORAGE_KEY = "goathub_cart";

  function readCart() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeCart(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* localStorage unavailable (private mode, etc.) — cart just won't persist */
    }
    updateBadge();
  }

  function getCart() {
    return readCart();
  }

  function getCount() {
    return readCart().reduce(function (sum, item) {
      return sum + (Number(item.quantity) || 0);
    }, 0);
  }

  function setQuantity(productId, quantity) {
    var items = readCart().filter(function (i) {
      return i.productId !== productId;
    });
    if (quantity > 0) {
      items.push({ productId: productId, quantity: quantity });
    }
    writeCart(items);
  }

  function addToCart(productId, quantity) {
    var items = readCart();
    var existing = items.find(function (i) {
      return i.productId === productId;
    });
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({ productId: productId, quantity: quantity });
    }
    writeCart(items);
  }

  function removeFromCart(productId) {
    writeCart(
      readCart().filter(function (i) {
        return i.productId !== productId;
      })
    );
  }

  function clearCart() {
    writeCart([]);
  }

  function updateBadge() {
    var count = getCount();
    document.querySelectorAll(".cart-badge").forEach(function (el) {
      el.textContent = String(count);
      el.hidden = count === 0;
    });
  }

  window.GoatHubCart = {
    getCart: getCart,
    getCount: getCount,
    addToCart: addToCart,
    setQuantity: setQuantity,
    removeFromCart: removeFromCart,
    clearCart: clearCart,
    updateBadge: updateBadge,
  };

  updateBadge();
})();
