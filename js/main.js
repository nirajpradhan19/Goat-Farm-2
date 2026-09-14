/* Silverbrook Goat Farm — site scripts */
(function () {
  "use strict";

  /* current year in footer */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* sticky header shadow */
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* mobile nav toggle */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".main-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      nav.classList.toggle("open");
      var expanded = nav.classList.contains("open");
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    });
    nav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        nav.classList.remove("open");
      });
    });
  }

  /* back to top */
  var toTop = document.querySelector(".to-top");
  if (toTop) {
    window.addEventListener(
      "scroll",
      function () {
        toTop.classList.toggle("show", window.scrollY > 480);
      },
      { passive: true }
    );
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* reveal-on-scroll — content is visible by default (see CSS); JS only
     opts elements into the hidden pre-animation state once it can promise
     to reveal them again, with a timeout safety net so nothing is ever
     left permanently invisible. */
  var revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length && "IntersectionObserver" in window) {
    revealEls.forEach(function (el) {
      el.classList.add("pre");
    });
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach(function (el) {
      io.observe(el);
    });
    /* safety net: guarantee visibility even if an element is somehow
       never reported as intersecting (e.g. zero-height edge cases) */
    setTimeout(function () {
      revealEls.forEach(function (el) {
        el.classList.add("in");
      });
    }, 4000);
  }

  /* animated counters */
  var counters = document.querySelectorAll("[data-count]");
  if (counters.length) {
    var animateCount = function (el) {
      var target = parseFloat(el.getAttribute("data-count"));
      var decimals = el.getAttribute("data-count").includes(".") ? 1 : 0;
      var duration = 1600;
      var start = null;
      var step = function (ts) {
        if (!start) start = ts;
        var progress = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        var value = target * eased;
        el.textContent = decimals ? value.toFixed(decimals) : Math.floor(value).toLocaleString();
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          el.textContent = decimals ? target.toFixed(decimals) : target.toLocaleString();
        }
      };
      requestAnimationFrame(step);
    };
    if ("IntersectionObserver" in window) {
      var cio = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              animateCount(entry.target);
              cio.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.5 }
      );
      counters.forEach(function (el) {
        cio.observe(el);
      });
    } else {
      counters.forEach(animateCount);
    }
  }

  /* testimonial slider */
  var track = document.querySelector(".testi-slides");
  if (track) {
    var slides = track.querySelectorAll(".testi-slide");
    var idx = 0;
    var go = function (i) {
      idx = (i + slides.length) % slides.length;
      track.style.transform = "translateX(-" + idx * 100 + "%)";
    };
    var next = document.querySelector('[data-testi="next"]');
    var prev = document.querySelector('[data-testi="prev"]');
    if (next) next.addEventListener("click", function () { go(idx + 1); });
    if (prev) prev.addEventListener("click", function () { go(idx - 1); });
    var auto = setInterval(function () { go(idx + 1); }, 6500);
    track.closest(".testi-wrap").addEventListener("mouseenter", function () { clearInterval(auto); });
  }

  /* FAQ accordion */
  document.querySelectorAll(".faq-q").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var item = btn.closest(".faq-item");
      var wasOpen = item.classList.contains("open");
      item.parentElement.querySelectorAll(".faq-item").forEach(function (i) {
        i.classList.remove("open");
      });
      if (!wasOpen) item.classList.add("open");
    });
  });

  /* gallery filter */
  var filterBtns = document.querySelectorAll("[data-filter]");
  var galleryItems = document.querySelectorAll("[data-cat]");
  if (filterBtns.length && galleryItems.length) {
    filterBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        filterBtns.forEach(function (b) { b.classList.remove("btn-forest"); b.classList.add("btn-ghost"); });
        btn.classList.add("btn-forest");
        btn.classList.remove("btn-ghost");
        var cat = btn.getAttribute("data-filter");
        galleryItems.forEach(function (item) {
          var show = cat === "all" || item.getAttribute("data-cat") === cat;
          item.style.display = show ? "" : "none";
        });
      });
    });
  }

  /* forms: contact + newsletter (static demo, no backend) */
  document.querySelectorAll("form[data-demo-form]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var success = form.querySelector(".form-success");
      if (success) {
        success.classList.add("show");
        setTimeout(function () { success.classList.remove("show"); }, 5000);
      }
      form.reset();
    });
  });
})();
