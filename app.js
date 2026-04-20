(function () {
  "use strict";

  var STORAGE_KEY = "gcse-maths-master-checklist-v2";
  var content = document.getElementById("content");
  var nav = document.getElementById("nav");
  var tpl = document.getElementById("subsectionTemplate");
  var searchInput = document.getElementById("search");
  var progressBar = document.getElementById("progressBar");
  var progressText = document.getElementById("progressText");

  var state = loadState();
  var dataset = window.CHECKLIST_DATA || null;

  if (!dataset || !dataset.domains) {
    content.innerHTML = '<section class="card"><h2>Data failed to load</h2><p class="sub">Make sure <code>data.js</code> is in the same folder as <code>index.html</code> and <code>app.js</code>.</p></section>';
    return;
  }

  render(dataset);
  bindGlobalActions();
  updateProgress();

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { checks: {}, notes: {} };
    } catch (e) {
      return { checks: {}, notes: {} };
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function slugify(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function makeId(domainId, sectionId, name) {
    return domainId + "__" + sectionId + "__" + slugify(name);
  }

  function fillList(ul, items) {
    ul.innerHTML = "";
    (items || []).forEach(function (item) {
      var li = document.createElement("li");
      li.textContent = item;
      ul.appendChild(li);
    });
  }

  function render(data) {
    content.innerHTML = "";
    nav.innerHTML = "";

    data.domains.forEach(function (domain) {
      var domainEl = document.createElement("article");
      domainEl.className = "domain";
      domainEl.setAttribute("data-domain-id", domain.id);

      var header = document.createElement("header");

      var tagsHtml = "";
      (domain.tags || []).forEach(function (tag) {
        tagsHtml += '<span class="tag">' + escapeHtml(tag) + "</span>";
      });

      header.innerHTML =
        '<div><h2 id="' + escapeHtml(domain.id) + '">' + escapeHtml(domain.name) +
        '</h2><div class="tags">' + tagsHtml + '</div></div>' +
        '<div class="tiny">' + String(domain.sections.length) + " section(s)</div>";
      domainEl.appendChild(header);

      var navLink = document.createElement("a");
      navLink.href = "#" + domain.id;
      navLink.textContent = domain.name;
      nav.appendChild(navLink);

      domain.sections.forEach(function (section) {
        var sectionEl = document.createElement("section");
        sectionEl.className = "section";
        sectionEl.setAttribute("data-priority", section.priority || "core");

        var sh = document.createElement("div");
        sh.className = "section-header";
        sh.innerHTML =
          "<div><h3>" + escapeHtml(section.name) + "</h3></div>" +
          '<span class="chip priority-' + escapeHtml(section.priority || "core") + '">' +
          escapeHtml((section.priority || "core").replace("_", " ")) +
          "</span>";
        sectionEl.appendChild(sh);

        (section.subsections || []).forEach(function (sub) {
          var node = tpl.content.firstElementChild.cloneNode(true);
          var id = makeId(domain.id, section.id, sub.name);
          var priority = sub.priority || section.priority || "core";

          node.setAttribute("data-item-id", id);
          node.setAttribute("data-priority", priority);
          node.querySelector(".title").textContent = sub.name;

          var chip = node.querySelector(".priority");
          chip.textContent = priority.replace("_", " ");
          chip.classList.add("priority-" + priority);

          fillList(node.querySelector(".knowledge"), sub.what_you_need_to_know);
          fillList(node.querySelector(".understanding"), sub.understanding);
          fillList(node.querySelector(".procedures"), sub.procedures);
          fillList(node.querySelector(".traps"), sub.exam_traps);
          fillList(node.querySelector(".selftest"), sub.self_test);

          var check = node.querySelector(".masterCheck");
          check.checked = !!state.checks[id];
          check.addEventListener("change", function () {
            state.checks[id] = check.checked;
            saveState();
            updateProgress();
          });

          var notes = node.querySelector(".notes");
          notes.value = state.notes[id] || "";
          notes.addEventListener("input", function () {
            state.notes[id] = notes.value;
            saveState();
          });

          sectionEl.appendChild(node);
        });

        domainEl.appendChild(sectionEl);
      });

      content.appendChild(domainEl);
    });
  }

  function bindGlobalActions() {
    var expandAll = document.getElementById("expandAll");
    var collapseAll = document.getElementById("collapseAll");
    var resetProgress = document.getElementById("resetProgress");
    var filters = document.querySelectorAll(".priorityFilter");

    expandAll.addEventListener("click", function () {
      document.querySelectorAll("details.subsection").forEach(function (d) {
        d.open = true;
      });
    });

    collapseAll.addEventListener("click", function () {
      document.querySelectorAll("details.subsection").forEach(function (d) {
        d.open = false;
      });
    });

    resetProgress.addEventListener("click", function () {
      var ok = window.confirm("Reset all saved checks and notes?");
      if (!ok) return;
      state = { checks: {}, notes: {} };
      saveState();
      render(dataset);
      bindGlobalActions();
      updateProgress();
      applyFilters();
    });

    searchInput.addEventListener("input", applyFilters);
    filters.forEach(function (cb) {
      cb.addEventListener("change", applyFilters);
    });
  }

  function applyFilters() {
    var q = String(searchInput.value || "").trim().toLowerCase();
    var allowed = {};
    document.querySelectorAll(".priorityFilter:checked").forEach(function (el) {
      allowed[el.value] = true;
    });

    document.querySelectorAll("details.subsection").forEach(function (item) {
      var text = item.textContent.toLowerCase();
      var pr = item.getAttribute("data-priority") || "core";
      var visible = !!allowed[pr] && (!q || text.indexOf(q) !== -1);
      item.classList.toggle("hidden", !visible);
    });

    document.querySelectorAll(".section").forEach(function (section) {
      var anyVisible = false;
      section.querySelectorAll("details.subsection").forEach(function (el) {
        if (!el.classList.contains("hidden")) anyVisible = true;
      });
      section.classList.toggle("hidden", !anyVisible);
    });

    document.querySelectorAll(".domain").forEach(function (domain) {
      var anyVisible = false;
      domain.querySelectorAll(".section").forEach(function (el) {
        if (!el.classList.contains("hidden")) anyVisible = true;
      });
      domain.classList.toggle("hidden", !anyVisible);
    });
  }

  function updateProgress() {
    var items = Array.prototype.slice.call(document.querySelectorAll("details.subsection"));
    var total = items.length || 1;
    var done = items.filter(function (item) {
      return item.querySelector(".masterCheck").checked;
    }).length;
    var pct = Math.round((done / total) * 100);
    progressBar.style.width = pct + "%";
    progressText.textContent = done + "/" + total + " (" + pct + "%)";
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
