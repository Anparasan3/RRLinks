/* ==========================================================================
   React Router Route Links — landing page interactions
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------ demo -- */

  var PREVIEWS = {
    home: {
      path: "app/routes/home.tsx",
      lines: [
        'import type { Route } from "./+types/home";',
        "",
        "export default function Home({ loaderData }: Route.ComponentProps) {",
        "  const { user } = loaderData;",
        "",
        "  return (",
        "    <main>",
        "      <h1>Welcome back, {user.name}</h1>",
        "      <Link to=\"/about\">About</Link>",
        "    </main>",
        "  );",
        "}",
      ],
    },
    about: {
      path: "app/routes/about.tsx",
      lines: [
        'import type { Route } from "./+types/about";',
        "",
        "export default function About({ loaderData }: Route.ComponentProps) {",
        "  return (",
        "    <main>",
        "      <h1>About</h1>",
        "      <p>{loaderData.description}</p>",
        "    </main>",
        "  );",
        "}",
      ],
    },
    "api-user": {
      path: "app/routes/api/user.tsx",
      lines: [
        'import type { Route } from "./+types/user";',
        "",
        "export async function loader({ params }: Route.LoaderArgs) {",
        "  const user = await db.user.findUnique({",
        "    where: { id: params.id },",
        "  });",
        "",
        "  if (!user) throw new Response(\"Not found\", { status: 404 });",
        "  return { user };",
        "}",
      ],
    },
  };

  var demo = document.getElementById("demo");
  var peek = document.getElementById("peek");
  var peekPath = document.getElementById("peekPath");
  var peekCode = document.getElementById("peekCode");
  var activeLink = null;

  function showPeek(link) {
    if (!demo || !peek) return;

    var key = link.getAttribute("data-target");
    var preview = PREVIEWS[key];
    if (!preview) return;

    if (activeLink) activeLink.classList.remove("is-active");
    link.classList.add("is-active");
    activeLink = link;

    peekPath.textContent = preview.path;

    peekCode.innerHTML = "";
    preview.lines.forEach(function (line) {
      var row = document.createElement("span");
      row.className = "pl";
      row.textContent = line === "" ? " " : line;
      peekCode.appendChild(row);
    });

    peek.hidden = false;
    positionPeek(link);
  }

  function positionPeek(link) {
    var body = demo.querySelector(".editor-body");
    if (!body) return;

    var bodyRect = body.getBoundingClientRect();
    var linkRect = link.getBoundingClientRect();

    // Measure the popup now that it is visible.
    var peekRect = peek.getBoundingClientRect();
    var pad = 12;

    var top = linkRect.bottom - bodyRect.top + 8;
    if (top + peekRect.height > bodyRect.height - 4) {
      top = Math.max(pad, linkRect.top - bodyRect.top - peekRect.height - 8);
    }

    var left = linkRect.left - bodyRect.left - 4;
    left = Math.min(left, bodyRect.width - peekRect.width - pad);
    left = Math.max(pad, left);

    peek.style.top = top + "px";
    peek.style.left = left + "px";
  }

  function hidePeek() {
    if (!peek) return;
    peek.hidden = true;
    if (activeLink) {
      activeLink.classList.remove("is-active");
      activeLink = null;
    }
  }

  if (demo) {
    demo.addEventListener("click", function (event) {
      var link = event.target.closest ? event.target.closest(".rlink") : null;
      if (link) {
        event.preventDefault();
        if (activeLink === link && !peek.hidden) {
          hidePeek();
        } else {
          showPeek(link);
        }
        return;
      }
      if (!event.target.closest(".peek")) hidePeek();
    });

    demo.addEventListener("keydown", function (event) {
      var link = event.target.closest ? event.target.closest(".rlink") : null;
      if (link && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        showPeek(link);
      }
    });

    // Demo tabs.
    var tabs = demo.querySelectorAll(".tab");
    var files = demo.querySelectorAll(".editor-file");

    function selectFile(name) {
      tabs.forEach(function (tab) {
        var on = tab.getAttribute("data-file") === name;
        tab.classList.toggle("is-active", on);
        tab.setAttribute("aria-selected", on ? "true" : "false");
      });
      files.forEach(function (file) {
        var on = file.getAttribute("data-file") === name;
        file.hidden = !on;
        file.classList.toggle("is-active", on);
      });
      hidePeek();
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        selectFile(tab.getAttribute("data-file"));
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") hidePeek();
    });

    window.addEventListener("resize", function () {
      if (activeLink && !peek.hidden) positionPeek(activeLink);
    });

    // Draw attention to the links once on load.
    window.setTimeout(function () {
      demo.querySelectorAll(".rlink").forEach(function (link) {
        link.classList.add("is-pulsing");
      });
    }, 900);
  }

  /* ------------------------------------------------------------ copy -- */

  document.querySelectorAll(".copy-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = document.getElementById(btn.getAttribute("data-copy-target"));
      if (!target) return;

      var text = target.innerText.trim();
      var done = function () {
        var original = btn.textContent;
        btn.textContent = "Copied";
        btn.classList.add("is-copied");
        window.setTimeout(function () {
          btn.textContent = original;
          btn.classList.remove("is-copied");
        }, 1600);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(fallbackCopy);
      } else {
        fallbackCopy();
      }

      function fallbackCopy() {
        var sel = window.getSelection();
        var range = document.createRange();
        range.selectNodeContents(target);
        sel.removeAllRanges();
        sel.addRange(range);
        try {
          document.execCommand("copy");
          done();
        } catch (err) {
          /* clipboard unavailable — leave the selection for manual copy */
        }
        sel.removeAllRanges();
      }
    });
  });

  /* --------------------------------------------------------- reveal -- */

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var revealTargets = document.querySelectorAll(
    ".section-head, .card, .panel, .compare-pane, .install-card, .faq details, .helpers"
  );

  /* Split a heading into words so they can rise into place one by one. */
  function splitWords(el) {
    if (!el || el.getAttribute("data-split") === "ready") return el;

    var frag = document.createDocumentFragment();
    var index = 0;

    function pushWord(node) {
      var wrap = document.createElement("span");
      wrap.className = "word";
      var inner = document.createElement("span");
      inner.className = "word-inner";
      inner.style.setProperty("--i", index++);
      inner.appendChild(node);
      wrap.appendChild(inner);
      frag.appendChild(wrap);
    }

    Array.prototype.slice.call(el.childNodes).forEach(function (node) {
      if (node.nodeType === 3) {
        node.textContent.split(/\s+/).forEach(function (part) {
          if (part) pushWord(document.createTextNode(part));
        });
      } else if (node.nodeType === 1 && node.tagName === "BR") {
        frag.appendChild(node.cloneNode());
      } else {
        pushWord(node.cloneNode(true));
      }
    });

    el.innerHTML = "";
    el.appendChild(frag);
    el.classList.add("split");
    el.setAttribute("data-split", "ready");
    return el;
  }

  if (!reduceMotion) {
    var headings = document.querySelectorAll("h1, .section-head h2");
    headings.forEach(splitWords);

    var heroTitle = document.querySelector("h1");
    if (heroTitle) {
      window.requestAnimationFrame(function () {
        window.setTimeout(function () {
          heroTitle.classList.add("is-in");
        }, 120);
      });
    }
  }

  if ("IntersectionObserver" in window && !reduceMotion) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry, i) {
          if (!entry.isIntersecting) return;
          var el = entry.target;

          if (el.classList.contains("split")) {
            el.classList.add("is-in");
          } else {
            el.style.setProperty("--reveal-delay", Math.min(i * 70, 280) + "ms");
            el.classList.add("is-visible");
          }

          observer.unobserve(el);
        });
      },
      { rootMargin: "0px 0px -50px 0px", threshold: 0 }
    );

    revealTargets.forEach(function (el) {
      el.classList.add("reveal");
      observer.observe(el);
    });

    document.querySelectorAll(".section-head h2.split").forEach(function (el) {
      observer.observe(el);
    });
  }

  /* -------------------------------------------------- stagger code -- */

  document.querySelectorAll(".editor-file .code").forEach(function (code) {
    code.querySelectorAll(".line").forEach(function (line, i) {
      line.style.setProperty("--i", i);
    });
  });

  /* ----------------------------------------------------- progress -- */

  var progress = document.getElementById("scrollProgress");
  var header = document.querySelector(".site-header");
  var ticking = false;

  function onScroll() {
    var y = window.scrollY;
    var max = document.documentElement.scrollHeight - window.innerHeight;

    if (progress) {
      var ratio = max > 0 ? Math.min(y / max, 1) : 0;
      progress.style.transform = "scaleX(" + ratio + ")";
    }

    if (header) {
      header.classList.toggle("is-scrolled", y > 8);
    }

    ticking = false;
  }

  window.addEventListener(
    "scroll",
    function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(onScroll);
      }
    },
    { passive: true }
  );
  onScroll();

  /* --------------------------------------------------- interactions -- */

  if (!reduceMotion) {
    // Cursor spotlight on feature cards.
    document.querySelectorAll(".card").forEach(function (card) {
      card.addEventListener("pointermove", function (event) {
        var rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", ((event.clientX - rect.left) / rect.width) * 100 + "%");
        card.style.setProperty("--my", ((event.clientY - rect.top) / rect.height) * 100 + "%");
      });
    });

    // Subtle 3D tilt on the editor demo.
    var tiltEl = document.querySelector("[data-tilt]");
    var tiltZone = tiltEl && tiltEl.closest(".hero-demo");

    if (tiltEl && tiltZone && window.matchMedia("(pointer: fine)").matches) {
      tiltZone.addEventListener("pointermove", function (event) {
        var rect = tiltEl.getBoundingClientRect();
        var px = (event.clientX - rect.left) / rect.width - 0.5;
        var py = (event.clientY - rect.top) / rect.height - 0.5;
        tiltEl.style.transform =
          "rotateX(" + (-py * 5).toFixed(2) + "deg) rotateY(" +
          (px * 6).toFixed(2) + "deg)";
      });

      tiltZone.addEventListener("pointerleave", function () {
        tiltEl.style.transform = "";
      });
    }
  }
})();
