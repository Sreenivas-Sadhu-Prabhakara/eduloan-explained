/* eduloan-explained — scroll-trigger + replay wiring only.
   All animation lives in styles.css behind prefers-reduced-motion;
   this file just adds .in-view classes. With JS disabled the page
   renders every section in its final, fully-legible state. */

"use strict";

(function () {
  var root = document.documentElement;
  root.classList.add("js");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var sections = Array.prototype.slice.call(document.querySelectorAll("[data-animate]"));

  function showAll() {
    sections.forEach(function (el) { el.classList.add("in-view"); });
  }

  if (reduceMotion.matches || !("IntersectionObserver" in window)) {
    showAll();
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
    sections.forEach(function (el) { io.observe(el); });

    // If the user flips the OS setting mid-visit, settle everything static.
    var onChange = function (e) { if (e.matches) showAll(); };
    if (typeof reduceMotion.addEventListener === "function") {
      reduceMotion.addEventListener("change", onChange);
    }

    // Replay buttons re-run a section's CSS animations.
    Array.prototype.slice.call(document.querySelectorAll("[data-replay]")).forEach(function (btn) {
      btn.hidden = false;
      btn.addEventListener("click", function () {
        var section = btn.closest("[data-animate]");
        if (!section) { return; }
        section.classList.remove("in-view");
        void section.offsetWidth; // force reflow so animations restart
        section.classList.add("in-view");
      });
    });
  }
})();
