/* Goat Hub — account page: login/signup, profile, order history */
(function () {
  "use strict";

  var loggedOutView = document.getElementById("loggedOutView");
  var loggedInView = document.getElementById("loggedInView");
  var banner = document.getElementById("accountBanner");

  var loginForm = document.getElementById("loginForm");
  var signupForm = document.getElementById("signupForm");
  var loginError = document.getElementById("loginError");
  var signupError = document.getElementById("signupError");

  var profileName = document.getElementById("profileName");
  var profileEmail = document.getElementById("profileEmail");
  var logoutBtn = document.getElementById("logoutBtn");

  var ordersLoading = document.getElementById("ordersLoading");
  var ordersEmpty = document.getElementById("ordersEmpty");
  var ordersList = document.getElementById("ordersList");

  function showBanner(text, type) {
    banner.textContent = text;
    banner.className = "admin-banner " + (type || "success");
    banner.hidden = false;
  }

  function formatPrice(cents) {
    return "$" + (cents / 100).toFixed(2);
  }
  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return iso;
    }
  }

  // ---- tabs ----
  document.querySelectorAll(".account-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".account-tab").forEach(function (t) {
        t.classList.remove("active");
      });
      tab.classList.add("active");
      var target = tab.dataset.tab;
      loginForm.hidden = target !== "login";
      signupForm.hidden = target !== "signup";
    });
  });

  // ---- login ----
  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    loginError.hidden = true;
    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: document.getElementById("loginEmail").value,
        password: document.getElementById("loginPassword").value,
      }),
    })
      .then(function (r) {
        return r.json().then(function (d) {
          return { ok: r.ok, data: d };
        });
      })
      .then(function (result) {
        if (result.ok) {
          afterAuthSuccess();
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

  // ---- signup ----
  signupForm.addEventListener("submit", function (e) {
    e.preventDefault();
    signupError.hidden = true;
    fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: document.getElementById("signupName").value,
        email: document.getElementById("signupEmail").value,
        password: document.getElementById("signupPassword").value,
      }),
    })
      .then(function (r) {
        return r.json().then(function (d) {
          return { ok: r.ok, data: d };
        });
      })
      .then(function (result) {
        if (result.ok) {
          afterAuthSuccess();
        } else {
          signupError.textContent = (result.data && result.data.error) || "Sign up failed";
          signupError.hidden = false;
        }
      })
      .catch(function () {
        signupError.textContent = "Network error — please try again.";
        signupError.hidden = false;
      });
  });

  function afterAuthSuccess() {
    var params = new URLSearchParams(window.location.search);
    if (params.get("next") === "checkout") {
      var cart = (window.GoatHubCart && window.GoatHubCart.getCart()) || [];
      if (cart.length > 0) {
        fetch("/api/orders/checkout", {
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
              showBanner((result.data && result.data.error) || "Checkout failed — please try again from the store.", "error");
              showLoggedIn();
            }
          })
          .catch(function () {
            showBanner("Network error during checkout — please try again from the store.", "error");
            showLoggedIn();
          });
        return;
      }
    }
    showLoggedIn();
  }

  // ---- logout ----
  logoutBtn.addEventListener("click", function () {
    fetch("/api/auth/logout", { method: "POST" }).finally(function () {
      window.location.href = "account.html";
    });
  });

  function showLoggedOut() {
    loggedOutView.hidden = false;
    loggedInView.hidden = true;
  }

  function showLoggedIn() {
    loggedOutView.hidden = true;
    loggedInView.hidden = false;

    fetch("/api/auth/me")
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (!data || !data.user) {
          showLoggedOut();
          return;
        }
        profileName.textContent = data.user.name || "Welcome!";
        profileEmail.textContent = data.user.email;
        maybeShowOrderConfirmation();
        loadOrders();
      });
  }

  function maybeShowOrderConfirmation() {
    var params = new URLSearchParams(window.location.search);
    if (params.get("order") !== "success") return;
    var sessionId = params.get("session_id");
    if (!sessionId) return;

    fetch("/api/orders/confirm?session_id=" + encodeURIComponent(sessionId))
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data && data.order) {
          if (window.GoatHubCart) window.GoatHubCart.clearCart();
          showBanner(
            "Thank you! Order #" + data.order.id + " confirmed — " + formatPrice(data.order.total_cents) + ". A record has been added to your order history below.",
            "success"
          );
        }
      })
      .catch(function () {});
  }

  function loadOrders() {
    ordersLoading.hidden = false;
    ordersEmpty.hidden = true;
    ordersList.innerHTML = "";

    fetch("/api/orders/mine")
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        ordersLoading.hidden = true;
        var orders = (data && data.orders) || [];
        if (orders.length === 0) {
          ordersEmpty.hidden = false;
          return;
        }
        orders.forEach(function (order) {
          var card = document.createElement("div");
          card.className = "order-card";
          var itemsLine = order.items
            .map(function (i) {
              return i.quantity + "× " + i.product_name;
            })
            .join(", ");
          card.innerHTML =
            '<div class="order-card-head">' +
            '<span class="order-id">Order #' + order.id + "</span>" +
            '<span class="order-status ' + order.status + '">' + order.status + "</span>" +
            "</div>" +
            '<div class="order-date">' + formatDate(order.created_at) + "</div>" +
            '<div class="order-items-line" style="margin-top:10px;">' + itemsLine + "</div>" +
            '<div class="order-total">' + formatPrice(order.total_cents) + "</div>";
          ordersList.appendChild(card);
        });
      })
      .catch(function () {
        ordersLoading.hidden = true;
        ordersEmpty.hidden = false;
      });
  }

  // ---- bootstrap ----
  fetch("/api/auth/me")
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      if (data && data.user) {
        showLoggedIn();
      } else {
        showLoggedOut();
      }
    })
    .catch(function () {
      showLoggedOut();
    });
})();
