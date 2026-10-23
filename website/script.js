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

  var revealTargets = document.querySelectorAll(
    ".section-head, .card, .panel, .compare-pane, .install-card, .faq details, .helpers"
  );

  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry, i) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          window.setTimeout(function () {
            el.classList.add("is-visible");
          }, Math.min(i * 60, 240));
          observer.unobserve(el);
        });
      },
      { rootMargin: "0px 0px -50px 0px", threshold: 0 }
    );

    revealTargets.forEach(function (el) {
      el.classList.add("reveal");
      observer.observe(el);
    });
  }
})();
