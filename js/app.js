/* Quaderno di tirocinio: interfaccia. I testi inseriti passano solo da textContent. */
(function () {
  "use strict";

  var L = window.TirocinioLogic;
  var STORAGE_KEY = "tirocinio-tfa:v1";
  var VIEWS = ["riepilogo", "calendario", "elenco", "attivita", "stampa", "impostazioni"];

  var state = {
    attivita: [],
    impostazioni: L.defaultSettings(),
    view: "riepilogo",
    editingId: null,
    calYear: new Date().getFullYear(),
    calMonth: new Date().getMonth(),
    selectedDay: L.todayISO(),
    filtroMese: "",
    filtroTipo: "",
    ricerca: "",
    stampaTipo: "entrambi",
    dashMese: L.currentMonthKey(),
    dialogCancel: null,
    lastFocus: null,
    loadError: ""
  };

  var toastTimer = 0;

  function $(id) { return document.getElementById(id); }

  function mount(parent, nodes) {
    parent.replaceChildren();
    nodes.flat().forEach(function (node) {
      if (node == null || node === false) return;
      parent.append(node);
    });
  }

  function h(tag, props) {
    var node = document.createElement(tag);
    var children = Array.prototype.slice.call(arguments, 2);
    if (props) {
      Object.keys(props).forEach(function (key) {
        var value = props[key];
        if (value == null || value === false) return;
        if (key === "class") node.className = value;
        else if (key === "text") node.textContent = String(value);
        else if (key.indexOf("on") === 0 && typeof value === "function") {
          node.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (value === true) node.setAttribute(key, "");
        else node.setAttribute(key, String(value));
      });
    }
    children.flat().forEach(function (child) {
      if (child == null || child === false) return;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function showBanner(message) {
    var el = $("banner");
    el.hidden = false;
    el.textContent = message;
  }

  function hideBanner() {
    var el = $("banner");
    el.hidden = true;
    el.textContent = "";
  }

  function toast(message) {
    var el = $("toast");
    el.hidden = false;
    el.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 3400);
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        versione: 1,
        impostazioni: state.impostazioni,
        attivita: state.attivita
      }));
      if (state.loadError) {
        state.loadError = "";
        hideBanner();
      }
    } catch (err) {
      showBanner("Impossibile salvare su questo browser. Esporta un backup appena puoi.");
    }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      var checked = L.validateBackup(data);
      if (!checked.ok) throw new Error(checked.error);
      state.attivita = checked.backup.attivita;
      state.impostazioni = L.normalizeSettings(checked.backup.impostazioni || data.impostazioni);
    } catch (err) {
      state.attivita = [];
      state.impostazioni = L.defaultSettings();
      state.loadError = "I dati salvati su questo browser non sono leggibili. Puoi ricominciare o importare un backup JSON.";
    }
  }

  function findEntry(id) {
    for (var i = 0; i < state.attivita.length; i++) {
      if (state.attivita[i].id === id) return state.attivita[i];
    }
    return null;
  }

  function sortedAsc() {
    return state.attivita.slice().sort(L.compareEntriesAsc);
  }

  function motion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  }

  function showView(view, updateHash) {
    if (VIEWS.indexOf(view) === -1) view = "riepilogo";
    state.view = view;
    if (updateHash !== false) {
      var next = "#" + view;
      if (location.hash !== next) location.hash = next;
    }
    document.querySelectorAll(".view").forEach(function (section) {
      section.classList.toggle("is-active", section.id === "view-" + view);
    });
    document.querySelectorAll("[data-view]").forEach(function (tab) {
      var on = tab.dataset.view === view;
      tab.classList.toggle("is-active", on);
      if (on) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
    if (view === "impostazioni") fillSettingsForm();
    if (view === "stampa") renderPrintTable();
  }

  function parseHash() {
    var raw = (location.hash || "#riepilogo").replace(/^#/, "");
    var view = raw.split("/")[0];
    return VIEWS.indexOf(view) === -1 ? "riepilogo" : view;
  }

  function renderHeader() {
    var nome = state.impostazioni.nomeCorsista || "Corsista";
    $("header-corsista").textContent = nome;
    document.title = "Quaderno di tirocinio — " + nome;
    renderPrintRunning();
  }

  function renderPrintRunning() {
    var s = state.impostazioni;
    var nome = s.nomeCorsista || "Corsista";
    var anno = s.annoAccademico ? " — A.A. " + s.annoAccademico : "";
    $("print-running").textContent = "Quaderno di tirocinio — " + nome + anno;
  }

  function fillPrintFields() {
    document.querySelectorAll("[data-setting]").forEach(function (el) {
      if (document.activeElement === el) return;
      var key = el.dataset.setting;
      el.value = state.impostazioni[key] == null ? "" : state.impostazioni[key];
    });
  }

  function fillSettingsForm() {
    var s = state.impostazioni;
    $("set-obb-diretto").value = String(s.obiettivoDiretto);
    $("set-obb-indiretto").value = String(s.obiettivoIndiretto);
    $("set-lim-mese").value = String(s.limiteMensile);
    $("set-lim-sett").value = String(s.limiteSettimanale);
  }

  function progressNode(label, done, target, kind) {
    var pct = target > 0 ? Math.max(0, Math.min(100, (done / target) * 100)) : 0;
    var remain = L.roundOre(target - done);
    var extra = "";
    if (done > target) extra = "Obiettivo superato di " + L.formatOre(done - target) + " ore.";
    else if (L.roundOre(done) === L.roundOre(target)) extra = "Obiettivo raggiunto.";
    else extra = "Restano " + L.formatOre(remain) + " ore.";
    var bar = h("div", {
      class: "progress" + (kind ? " " + kind : ""),
      role: "progressbar",
      "aria-valuemin": "0",
      "aria-valuemax": String(target),
      "aria-valuenow": String(done),
      "aria-label": label
    }, h("span", { style: "width:" + pct.toFixed(2) + "%" }));
    return h("article", { class: "stat" + (kind === "totale" ? " stat-total" : "") },
      h("div", { class: "stat-top" },
        h("h3", { text: label }),
        h("strong", { text: L.formatOre(done) + " / " + L.formatOre(target) })
      ),
      bar,
      h("p", { class: "remain" + (done > target ? " ok-text" : ""), text: extra })
    );
  }

  function renderDashboard() {
    var root = $("dash-root");
    var totals = L.sumByTipo(state.attivita);
    var s = state.impostazioni;
    var obiettivoTotale = L.roundOre(s.obiettivoDiretto + s.obiettivoIndiretto);
    var monthKey = state.dashMese || L.currentMonthKey();
    if (!/^\d{4}-\d{2}$/.test(monthKey)) monthKey = L.currentMonthKey();
    state.dashMese = monthKey;
    var parts = monthKey.split("-");
    var year = Number(parts[0]);
    var monthIndex = Number(parts[1]) - 1;
    var monthEntries = state.attivita.filter(function (e) { return e.data.slice(0, 7) === monthKey; });
    var monthDiretto = L.sumOre(monthEntries.filter(function (e) { return e.tipo === "diretto"; }));
    var monthOver = L.isOver(monthDiretto, s.limiteMensile);
    var weeks = L.weeksOverlappingMonth(year, monthIndex, state.attivita);
    var thisWeek = L.startOfWeek(new Date());
    var thisWeekISO = L.toISODate(thisWeek);
    var thisWeekEndISO = L.toISODate(L.addDays(thisWeek, 6));
    var thisWeekSums = L.sumByTipo(state.attivita.filter(function (e) {
      return e.data >= thisWeekISO && e.data <= thisWeekEndISO;
    }));
    var thisWeekOver = L.isOver(thisWeekSums.totale, s.limiteSettimanale);

    var monthStartISO = monthKey + "-01";
    var monthEndISO = L.toISODate(new Date(year, monthIndex + 1, 0));
    var weekItems = weeks.filter(function (week) {
      return week.entries.length > 0 || week.startISO === thisWeekISO;
    }).map(function (week) {
      var sums = L.sumByTipo(week.entries);
      var over = L.isOver(sums.totale, s.limiteSettimanale);
      var note = L.formatOre(sums.totale) + " ore totali (" + L.formatOre(sums.diretto) + " diretto, " + L.formatOre(sums.indiretto) + " indiretto)";
      var hasOutside = week.entries.some(function (e) {
        return e.data < monthStartISO || e.data > monthEndISO;
      });
      var outside = hasOutside ? " Il totale include i giorni della settimana fuori da questo mese." : "";
      return h("li", {},
        h("div", { class: "row-main" },
          h("span", { text: L.formatWeekRange(week.start, week.end) }),
          h("span", { class: "badge " + (over ? "badge-warn" : "badge-ok"), text: over ? "Oltre il limite" : "Entro il limite" })
        ),
        week.startISO === thisWeekISO ? h("span", { class: "badge badge-now", text: "Questa settimana" }) : null,
        h("span", { class: "muted", text: note + outside })
      );
    });

    var months = L.monthsInEntries(state.attivita);
    var monthItems = months.map(function (key) {
      var entries = state.attivita.filter(function (e) { return e.data.slice(0, 7) === key; });
      var sums = L.sumByTipo(entries);
      var over = L.isOver(sums.diretto, s.limiteMensile);
      var label = L.formatOre(sums.diretto) + " ore diretto";
      if (sums.indiretto > 0) label += " · " + L.formatOre(sums.indiretto) + " indiretto";
      return h("li", {},
        h("div", { class: "row-main" },
          h("span", { text: L.formatMonth(key) }),
          h("strong", { text: label })
        ),
        h("span", { class: "badge " + (over ? "badge-warn" : "badge-ok"), text: over ? "Supera " + L.formatOre(s.limiteMensile) + " ore" : "Entro " + L.formatOre(s.limiteMensile) + " ore" })
      );
    });

    var overMonths = months.filter(function (key) {
      var entries = state.attivita.filter(function (e) { return e.data.slice(0, 7) === key && e.tipo === "diretto"; });
      return L.isOver(L.sumOre(entries), s.limiteMensile);
    });

    mount(root, [
      state.attivita.length === 0
        ? h("p", { class: "empty", text: "Nessuna attività registrata. Quando aggiungi la prima, qui vedi l'avanzamento verso " + L.formatOre(s.obiettivoDiretto) + " ore di diretto e " + L.formatOre(s.obiettivoIndiretto) + " di indiretto." })
        : null,
      h("div", { class: "stats" },
        progressNode("Tirocinio diretto", totals.diretto, s.obiettivoDiretto, "diretto"),
        progressNode("Tirocinio indiretto", totals.indiretto, s.obiettivoIndiretto, "indiretto"),
        progressNode("Totale", totals.totale, obiettivoTotale, "totale")
      ),
      overMonths.length
        ? h("p", { class: "callout callout-warn", text: overMonths.length === 1
            ? "1 mese supera il limite di ore dirette."
            : overMonths.length + " mesi superano il limite di ore dirette." })
        : null,
      thisWeekOver
        ? h("p", { class: "callout callout-warn", text: "Questa settimana (" + L.formatWeekRange(thisWeek, L.parseISODate(thisWeekEndISO)) + "): " + L.formatOre(thisWeekSums.totale) + " ore totali. Supera il limite di " + L.formatOre(s.limiteSettimanale) + " ore a settimana." })
        : h("p", { class: "callout callout-ok", text: "Questa settimana (" + L.formatWeekRange(thisWeek, L.parseISODate(thisWeekEndISO)) + "): " + L.formatOre(thisWeekSums.totale) + " ore totali su " + L.formatOre(s.limiteSettimanale) + "." }),
      h("div", { class: "check-grid" },
        h("section", { class: "check-card" },
          h("h3", { text: "Controllo del mese" }),
          h("div", { class: "month-picker" },
            h("label", { text: "Mese" },
              h("input", { id: "dash-mese", type: "month", value: monthKey })
            )
          ),
          h("p", { class: monthOver ? "callout callout-warn" : "callout callout-ok", text: monthOver
            ? "Diretto: " + L.formatOre(monthDiretto) + " ore. Supera il limite di " + L.formatOre(s.limiteMensile) + " ore al mese."
            : "Diretto: " + L.formatOre(monthDiretto) + " ore su un massimo di " + L.formatOre(s.limiteMensile) + "." }),
          h("h3", { text: "Settimane" }),
          h("p", { class: "hint", text: "La settimana va da lunedì a domenica. L'avviso scatta se il totale (diretto + indiretto) supera " + L.formatOre(s.limiteSettimanale) + " ore." }),
          weekItems.length
            ? h("ul", { class: "week-list" }, weekItems)
            : h("p", { class: "muted", text: "Nessuna ora in questo mese." })
        ),
        h("section", { class: "check-card" },
          h("h3", { text: "Tutti i mesi" }),
          months.length
            ? h("ul", { class: "month-list" }, monthItems)
            : h("p", { class: "muted", text: "Non ci sono ancora ore da riepilogare." })
        )
      )
    ]);

    var picker = $("dash-mese");
    if (picker) {
      picker.addEventListener("change", function () {
        state.dashMese = picker.value || L.currentMonthKey();
        renderDashboard();
      });
    }
  }

  function daySummary(entries) {
    if (!entries.length) return { dots: "", hours: "", label: "nessuna attività" };
    var hasD = entries.some(function (e) { return e.tipo === "diretto"; });
    var hasI = entries.some(function (e) { return e.tipo === "indiretto"; });
    var kind = hasD && hasI ? "entrambi" : hasD ? "diretto" : "indiretto";
    return {
      kind: kind,
      hours: L.formatOre(L.sumOre(entries)),
      label: L.formatOre(L.sumOre(entries)) + " ore, " + (kind === "entrambi" ? "diretto e indiretto" : kind)
    };
  }

  function renderCalendar() {
    var label = L.formatMonth(state.calYear + "-" + String(state.calMonth + 1).padStart(2, "0"));
    $("cal-label").textContent = label;
    var grid = $("cal-grid");
    var cells = L.buildMonthGrid(state.calYear, state.calMonth);
    var today = L.todayISO();
    grid.replaceChildren.apply(grid, cells.map(function (cell) {
      if (!cell) return h("div", { class: "cal-empty" });
      var entries = L.entriesOnDate(state.attivita, cell.iso);
      var summary = daySummary(entries);
      var dots = h("span", { class: "dots" });
      if (summary.kind === "diretto" || summary.kind === "entrambi") dots.append(h("i", { class: "dot diretto" }));
      if (summary.kind === "indiretto" || summary.kind === "entrambi") dots.append(h("i", { class: "dot indiretto" }));
      var btn = h("button", {
        type: "button",
        class: "cal-day" + (cell.iso === today ? " is-today" : "") + (cell.iso === state.selectedDay ? " is-selected" : ""),
        role: "gridcell",
        "data-action": "open-day",
        "data-date": cell.iso,
        "aria-label": L.formatDateLong(cell.iso) + ", " + summary.label,
        "aria-pressed": cell.iso === state.selectedDay ? "true" : "false"
      },
        h("span", { class: "day-num", text: String(cell.date.getDate()) }),
        dots,
        summary.hours ? h("span", { class: "cal-hours", text: summary.hours }) : null
      );
      if (cell.iso === today) btn.setAttribute("aria-current", "date");
      return btn;
    }));
    renderDayPanel();
  }

  function renderDayPanel() {
    var panel = $("day-panel");
    var iso = state.selectedDay;
    if (!iso) {
      panel.replaceChildren(h("p", { class: "muted", text: "Seleziona un giorno per vedere o aggiungere le attività." }));
      return;
    }
    var entries = L.entriesOnDate(state.attivita, iso);
    var cards = entries.map(function (e) { return entryCard(e); });
    panel.replaceChildren(
      h("h3", { text: capitalDate(iso) }),
      h("button", {
        type: "button",
        class: "btn btn-primary",
        "data-action": "add-day",
        "data-date": iso,
        text: "Aggiungi attività"
      }),
      cards.length ? h("div", {}, cards) : h("p", { class: "empty", text: "Nessuna attività in questo giorno." })
    );
  }

  function entryCard(e) {
    var where = [e.scuola, e.classe].filter(Boolean).join(" · ");
    return h("article", { class: "entry-card" },
      h("div", { class: "row-main" },
        h("strong", { text: e.dalle + "–" + e.alle + " · " + L.formatOre(e.ore) + " ore" }),
        h("span", { class: "badge badge-" + e.tipo, text: L.tipoLabel(e.tipo) })
      ),
      where ? h("p", { class: "muted", text: where }) : null,
      h("p", { text: e.attivita || "—" }),
      e.note ? h("p", { class: "muted", text: "Note: " + e.note }) : null,
      h("div", { class: "entry-actions" },
        h("button", { type: "button", class: "btn btn-small", "data-action": "edit", "data-id": e.id, text: "Modifica" }),
        h("button", { type: "button", class: "btn btn-small btn-danger", "data-action": "delete", "data-id": e.id, text: "Elimina" })
      )
    );
  }

  function syncMonthFilter() {
    var select = $("filtro-mese");
    var months = L.monthsInEntries(state.attivita).slice().reverse();
    var signature = months.join("|");
    if (select.dataset.signature !== signature) {
      var current = state.filtroMese;
      select.replaceChildren(h("option", { value: "", text: "Tutti i mesi" }));
      months.forEach(function (m) {
        select.append(h("option", { value: m, text: L.formatMonth(m) }));
      });
      select.dataset.signature = signature;
      if (current && months.indexOf(current) === -1) state.filtroMese = "";
    }
    select.value = state.filtroMese;
  }

  function appendHighlighted(parent, text, query) {
    var q = (query || "").trim();
    if (!q) {
      parent.append(document.createTextNode(text));
      return;
    }
    var foldedText = L.fold(text);
    var foldedQuery = L.fold(q);
    if (!foldedQuery) {
      parent.append(document.createTextNode(text));
      return;
    }
    var i = 0;
    while (i < text.length) {
      var idx = foldedText.indexOf(foldedQuery, i);
      if (idx === -1) {
        parent.append(document.createTextNode(text.slice(i)));
        return;
      }
      if (idx > i) parent.append(document.createTextNode(text.slice(i, idx)));
      parent.append(h("mark", { text: text.slice(idx, idx + foldedQuery.length) }));
      i = idx + foldedQuery.length;
    }
  }

  function renderList() {
    syncMonthFilter();
    var filtered = L.filterEntries(state.attivita, {
      mese: state.filtroMese,
      tipo: state.filtroTipo,
      ricerca: state.ricerca
    }).sort(L.compareEntriesAsc).reverse();
    var sums = L.sumByTipo(filtered);
    $("elenco-count").textContent = filtered.length === 1
      ? "1 attività · " + L.formatOre(sums.totale) + " ore"
      : filtered.length + " attività · " + L.formatOre(sums.totale) + " ore";
    var body = $("elenco-body");
    body.replaceChildren.apply(body, filtered.map(function (e) {
      var where = [e.scuola, e.classe].filter(Boolean).join(" · ") || "—";
      var att = h("td", { "data-label": "Attività", class: "cell-att" });
      appendHighlighted(att, e.attivita || "—", state.ricerca);
      if (e.note) {
        var note = h("div", { class: "muted" });
        note.append(document.createTextNode("Note: "));
        appendHighlighted(note, e.note, state.ricerca);
        att.append(note);
      }
      return h("tr", {},
        h("td", { "data-label": "Data", text: L.formatDateIT(e.data) }),
        h("td", { "data-label": "Orario", text: e.dalle + "–" + e.alle }),
        h("td", { "data-label": "Ore", text: L.formatOre(e.ore) }),
        h("td", { "data-label": "Tipo" }, h("span", { class: "badge badge-" + e.tipo, text: L.tipoLabel(e.tipo) })),
        h("td", { "data-label": "Scuola / classe", text: where }),
        att,
        h("td", { "data-label": "Azioni", class: "actions-cell" },
          h("div", { class: "actions" },
            h("button", { type: "button", class: "btn btn-small", "data-action": "edit", "data-id": e.id, text: "Modifica" }),
            h("button", { type: "button", class: "btn btn-small btn-danger", "data-action": "delete", "data-id": e.id, text: "Elimina" })
          )
        )
      );
    }));
    $("elenco-vuoto").hidden = filtered.length !== 0;
  }

  function renderPrintTable() {
    var tipo = state.stampaTipo;
    var entries = sortedAsc().filter(function (e) {
      if (tipo === "entrambi") return true;
      return e.tipo === tipo;
    });
    var body = $("print-body");
    if (!entries.length) {
      body.replaceChildren(h("tr", {}, h("td", { colspan: "8", text: "Nessuna attività registrata per questo registro." })));
    } else {
      body.replaceChildren.apply(body, entries.map(function (e) {
        var att = h("td", { class: "col-att" }, h("div", { text: e.attivita || "" }));
        var where = [e.scuola, e.classe].filter(Boolean).join(" · ");
        if (where) att.append(h("div", { class: "sub", text: where }));
        if (e.note) att.append(h("div", { class: "sub", text: "Note: " + e.note }));
        return h("tr", {},
          h("td", { class: "col-center", text: L.formatDateIT(e.data) }),
          h("td", { class: "col-center", text: e.dalle }),
          h("td", { class: "col-center", text: e.alle }),
          h("td", { class: "col-center", text: L.formatOre(e.ore) }),
          h("td", { class: "col-center", text: L.tipoLabel(e.tipo) }),
          att,
          h("td", { class: "col-firma", "aria-label": "Firma studente" }, "\u00a0"),
          h("td", { class: "col-firma", "aria-label": "Firma tutor" }, "\u00a0")
        );
      }));
    }
    var sums = L.sumByTipo(entries);
    var text;
    if (!entries.length) text = "Totale ore: 0";
    else if (tipo === "diretto") text = "Totale ore diretto: " + L.formatOre(sums.diretto) + " · Attività: " + entries.length;
    else if (tipo === "indiretto") text = "Totale ore indiretto: " + L.formatOre(sums.indiretto) + " · Attività: " + entries.length;
    else text = "Diretto: " + L.formatOre(sums.diretto) + " ore — Indiretto: " + L.formatOre(sums.indiretto) + " ore — Totale: " + L.formatOre(sums.totale) + " ore — Attività: " + entries.length;
    $("print-totali").textContent = text;
  }

  function refreshDatalists() {
    var scuole = [];
    var classi = [];
    state.attivita.forEach(function (e) {
      if (e.scuola && scuole.indexOf(e.scuola) === -1) scuole.push(e.scuola);
      if (e.classe && classi.indexOf(e.classe) === -1) classi.push(e.classe);
    });
    $("scuole-list").replaceChildren.apply($("scuole-list"), scuole.map(function (s) { return h("option", { value: s }); }));
    $("classi-list").replaceChildren.apply($("classi-list"), classi.map(function (s) { return h("option", { value: s }); }));
  }

  function capitalDate(iso) {
    var long = L.formatDateLong(iso);
    if (!long) return "";
    return long.charAt(0).toLocaleUpperCase("it") + long.slice(1);
  }

  function renderAll() {
    if (state.editingId && !findEntry(state.editingId)) resetForm(L.todayISO());
    renderHeader();
    fillPrintFields();
    renderDashboard();
    renderCalendar();
    renderList();
    renderPrintTable();
    refreshDatalists();
    updateFormMode();
  }

  function clearErrors() {
    ["err-data", "err-dalle", "err-alle", "err-ore", "err-tipo", "err-attivita", "form-errore"].forEach(function (id) {
      var el = $(id);
      el.hidden = true;
      el.textContent = "";
    });
    ["data", "dalle", "alle", "ore", "attivita-svolte"].forEach(function (id) {
      $(id).removeAttribute("aria-invalid");
    });
  }

  function setError(inputId, errorId, message) {
    var input = $(inputId);
    var err = $(errorId);
    if (input) input.setAttribute("aria-invalid", "true");
    err.hidden = false;
    err.textContent = message;
  }

  function updateOreHint() {
    var ore = L.parseOre($("ore").value);
    $("ore-hint").textContent = ore && ore > 0 ? L.formatOreLunghe(ore) : "Si calcolano da dalle/alle. Puoi modificarle (usa la virgola).";
  }

  function recomputeOre() {
    var hours = L.hoursBetween($("dalle").value, $("alle").value);
    if (hours != null) $("ore").value = L.formatOre(hours);
    updateOreHint();
  }

  function selectedTipo() {
    var checked = document.querySelector('input[name="tipo"]:checked');
    return checked ? checked.value : "";
  }

  function setTipo(tipo) {
    var el = document.querySelector('input[name="tipo"][value="' + (tipo === "indiretto" ? "indiretto" : "diretto") + '"]');
    if (el) el.checked = true;
  }

  function resetForm(dateISO) {
    $("form-attivita").reset();
    state.editingId = null;
    $("data").value = dateISO || L.todayISO();
    setTipo("diretto");
    var last = sortedAsc().slice(-1)[0];
    if (last) {
      $("scuola").value = last.scuola || "";
      $("classe").value = last.classe || "";
      setTipo(last.tipo);
    }
    clearErrors();
    updateOreHint();
    updateFormMode();
  }

  function fillForm(entry) {
    clearErrors();
    $("data").value = entry.data;
    $("dalle").value = entry.dalle;
    $("alle").value = entry.alle;
    $("ore").value = L.formatOre(entry.ore);
    setTipo(entry.tipo);
    $("scuola").value = entry.scuola || "";
    $("classe").value = entry.classe || "";
    $("attivita-svolte").value = entry.attivita || "";
    $("note").value = entry.note || "";
    updateOreHint();
    updateFormMode();
  }

  function updateFormMode() {
    var editing = !!state.editingId;
    $("attivita-titolo").textContent = editing ? "Modifica attività" : "Nuova attività";
    $("btn-salva").textContent = editing ? "Salva modifiche" : "Salva attività";
    $("btn-annulla-modifica").hidden = !editing;
    $("btn-elimina-modifica").hidden = !editing;
  }

  function startNew(dateISO) {
    resetForm(dateISO || L.todayISO());
    showView("attivita");
    $("data").focus();
  }

  function editEntry(id) {
    var entry = findEntry(id);
    if (!entry) {
      toast("Attività non trovata.");
      return;
    }
    state.editingId = id;
    fillForm(entry);
    showView("attivita");
    $("form-attivita").scrollIntoView({ behavior: motion(), block: "start" });
  }

  function removeEntry(id) {
    state.attivita = state.attivita.filter(function (e) { return e.id !== id; });
    if (state.editingId === id) resetForm($("data").value || L.todayISO());
    save();
    renderAll();
    toast("Attività eliminata.");
  }

  function confirmDelete(id) {
    var entry = findEntry(id);
    if (!entry) return;
    openDialog({
      title: "Eliminare l'attività?",
      body: "Eliminare l'attività del " + L.formatDateIT(entry.data) + " (" + L.formatOre(entry.ore) + " ore, " + L.tipoLabel(entry.tipo).toLocaleLowerCase("it") + ")? L'operazione non si può annullare.",
      actions: [
        { key: "cancel", label: "Annulla", className: "btn" },
        { key: "confirm-delete", label: "Elimina", className: "btn btn-danger", onClick: function () { removeEntry(id); } }
      ]
    });
  }

  function readEntryFromForm() {
    clearErrors();
    var data = $("data").value;
    var dalle = L.normalizeTime($("dalle").value);
    var alle = L.normalizeTime($("alle").value);
    var tipo = selectedTipo();
    var oreField = L.parseOre($("ore").value);
    var auto = L.hoursBetween(dalle, alle);
    var ore = oreField == null ? auto : oreField;
    var attivita = L.cleanText($("attivita-svolte").value, 4000);
    var valid = true;
    if (!L.isValidISODate(data)) {
      setError("data", "err-data", "Inserisci la data.");
      valid = false;
    }
    if (!dalle) {
      setError("dalle", "err-dalle", "Inserisci l'orario di inizio.");
      valid = false;
    }
    if (!alle) {
      setError("alle", "err-alle", "Inserisci l'orario di fine.");
      valid = false;
    }
    if (dalle && alle && L.hoursBetween(dalle, alle) == null) {
      setError("alle", "err-alle", "L'orario di fine deve essere successivo all'orario di inizio.");
      valid = false;
    }
    if (ore == null || ore <= 0) {
      setError("ore", "err-ore", "Inserisci le ore, maggiori di zero e non oltre 24.");
      valid = false;
    }
    if (tipo !== "diretto" && tipo !== "indiretto") {
      $("err-tipo").hidden = false;
      $("err-tipo").textContent = "Scegli il tipo di attività.";
      valid = false;
    }
    if (!attivita) {
      setError("attivita-svolte", "err-attivita", "Descrivi le attività svolte.");
      valid = false;
    }
    if (!valid) {
      var first = document.querySelector("[aria-invalid='true'], #err-tipo:not([hidden])");
      if (first && first.focus) first.focus();
      return null;
    }
    return {
      id: state.editingId || L.newId(),
      data: data,
      dalle: dalle,
      alle: alle,
      ore: ore,
      tipo: tipo,
      scuola: L.cleanLine($("scuola").value, 160),
      classe: L.cleanLine($("classe").value, 40),
      attivita: attivita,
      note: L.cleanText($("note").value, 2000)
    };
  }

  function limitWarnings(entry, previous) {
    var hypothetical = state.attivita.filter(function (e) { return !previous || e.id !== previous.id; }).concat([entry]);
    var messages = [];
    var monthEntries = hypothetical.filter(function (e) { return e.tipo === "diretto" && e.data.slice(0, 7) === entry.data.slice(0, 7); });
    var monthOre = L.sumOre(monthEntries);
    if (L.isOver(monthOre, state.impostazioni.limiteMensile)) {
      messages.push("Nel mese le ore dirette sono " + L.formatOre(monthOre) + ", sopra il limite di " + L.formatOre(state.impostazioni.limiteMensile) + ".");
    }
    var date = L.parseISODate(entry.data);
    var start = L.toISODate(L.startOfWeek(date));
    var end = L.toISODate(L.addDays(L.parseISODate(start), 6));
    var weekEntries = hypothetical.filter(function (e) { return e.data >= start && e.data <= end; });
    var weekOre = L.sumOre(weekEntries);
    if (L.isOver(weekOre, state.impostazioni.limiteSettimanale)) {
      messages.push("Nella settimana le ore totali sono " + L.formatOre(weekOre) + ", sopra il limite di " + L.formatOre(state.impostazioni.limiteSettimanale) + ".");
    }
    return messages;
  }

  function onSubmit(event) {
    event.preventDefault();
    var previous = state.editingId ? findEntry(state.editingId) : null;
    var entry = readEntryFromForm();
    if (!entry) return;
    if (previous) {
      state.attivita = state.attivita.map(function (e) { return e.id === entry.id ? entry : e; });
    } else {
      state.attivita.push(entry);
    }
    var warnings = limitWarnings(entry, previous);
    var keepDate = entry.data;
    var keepTipo = entry.tipo;
    var keepScuola = entry.scuola;
    var keepClasse = entry.classe;
    var wasEdit = !!previous;
    state.editingId = null;
    state.selectedDay = entry.data;
    var d = L.parseISODate(entry.data);
    state.calYear = d.getFullYear();
    state.calMonth = d.getMonth();
    state.dashMese = entry.data.slice(0, 7);
    save();
    renderAll();
    if (wasEdit) {
      toast(warnings.length ? "Modifiche salvate. " + warnings[0] : "Modifiche salvate.");
      showView("elenco");
    } else {
      resetForm(keepDate);
      $("scuola").value = keepScuola;
      $("classe").value = keepClasse;
      setTipo(keepTipo);
      updateOreHint();
      toast(warnings.length ? "Attività salvata. " + warnings[0] : "Attività salvata.");
      $("dalle").focus();
    }
  }

  function openDialog(opts) {
    state.lastFocus = document.activeElement;
    state.dialogCancel = opts.onCancel || null;
    $("dialog-title").textContent = opts.title;
    var body = $("dialog-body");
    body.replaceChildren();
    if (typeof opts.body === "string") body.append(document.createTextNode(opts.body));
    else if (opts.body) body.append(opts.body);
    var actions = $("dialog-actions");
    actions.replaceChildren.apply(actions, (opts.actions || []).map(function (action) {
      return h("button", {
        type: "button",
        class: action.className || "btn",
        "data-dialog": action.key,
        text: action.label,
        onClick: function () {
          var keep = action.onClick && action.onClick() === false;
          if (!keep) closeDialog(false);
        }
      });
    }));
    $("dialog").hidden = false;
    var cancel = actions.querySelector('[data-dialog="cancel"]') || actions.querySelector("button");
    if (cancel) cancel.focus();
  }

  function closeDialog(cancelled) {
    $("dialog").hidden = true;
    $("dialog-body").replaceChildren();
    $("dialog-actions").replaceChildren();
    if (cancelled && state.dialogCancel) state.dialogCancel();
    state.dialogCancel = null;
    if (state.lastFocus && state.lastFocus.focus) state.lastFocus.focus();
  }

  function backupObject() {
    return {
      versione: 1,
      applicativo: "tirocinio-tfa",
      esportatoIl: new Date().toISOString(),
      impostazioni: state.impostazioni,
      attivita: sortedAsc()
    };
  }

  function backupFilename() {
    return "tirocinio-tfa-" + L.todayISO() + ".json";
  }

  function downloadBackup() {
    var blob = new Blob([JSON.stringify(backupObject(), null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = h("a", { href: url, download: backupFilename() });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    toast("Backup scaricato.");
  }

  async function shareBackup() {
    var file = new File([JSON.stringify(backupObject(), null, 2)], backupFilename(), { type: "application/json" });
    try {
      await navigator.share({ files: [file], title: "Backup tirocinio TFA" });
    } catch (err) {
      if (err && err.name === "AbortError") return;
      toast("Condivisione non disponibile. Usa Esporta JSON.");
    }
  }

  function canShareFiles() {
    try {
      var file = new File(["{}"], "test.json", { type: "application/json" });
      return !!(navigator.canShare && navigator.canShare({ files: [file] }));
    } catch (err) {
      return false;
    }
  }

  function applyImportedSettings(partial) {
    if (!partial) return;
    state.impostazioni = L.normalizeSettings(Object.assign({}, state.impostazioni, partial));
    fillPrintFields();
    fillSettingsForm();
  }

  function finishImport(backup, mode, withSettings) {
    if (mode === "replace") state.attivita = backup.attivita.slice();
    else state.attivita = L.mergeEntries(state.attivita, backup.attivita);
    if (withSettings) applyImportedSettings(backup.impostazioni);
    save();
    renderAll();
    var n = state.attivita.length;
    toast(mode === "replace"
      ? "Registro sostituito: " + countLabel(n) + "."
      : (n === 1 ? "Backup unito. Ora c'è " : "Backup unito. Ora ci sono ") + countLabel(n) + ".");
  }

  function askImport(backup) {
    var locali = state.attivita.length;
    var incoming = backup.attivita.length;
    var when = "";
    if (backup.esportatoIl) {
      var d = new Date(backup.esportatoIl);
      if (!isNaN(d.getTime())) when = " File del " + d.toLocaleString("it-IT") + ".";
    }
    var body = h("div", {},
      h("p", { text: "Il file contiene " + incoming + (incoming === 1 ? " attività." : " attività.") + " Sul dispositivo ce ne sono " + locali + "." + when }),
      h("p", { text: "Unisci tiene le attività già presenti e aggiorna quelle con lo stesso identificativo. Sostituisci cancella il registro attuale." })
    );
    var settingsBox = null;
    if (backup.impostazioni) {
      settingsBox = h("label", { class: "check" },
        h("input", { type: "checkbox", id: "import-settings" }),
        " Aggiorna anche intestazione, obiettivi e limiti"
      );
      body.append(settingsBox);
    }
    function withSettings() {
      var box = $("import-settings");
      return !!(box && box.checked && backup.impostazioni);
    }
    openDialog({
      title: "Importa backup",
      body: body,
      actions: [
        { key: "cancel", label: "Annulla", className: "btn" },
        { key: "merge", label: "Unisci", className: "btn btn-primary", onClick: function () {
          finishImport(backup, "merge", withSettings());
        } },
        { key: "replace", label: "Sostituisci", className: "btn btn-danger", onClick: function () {
          var updateSettings = withSettings();
          openDialog({
            title: "Sostituire il registro?",
            body: "Le attività attuali che non sono nel file andranno perse.",
            actions: [
              { key: "cancel", label: "Annulla", className: "btn" },
              { key: "confirm-replace", label: "Sostituisci tutto", className: "btn btn-danger", onClick: function () {
                finishImport(backup, "replace", updateSettings);
              } }
            ]
          });
          return false;
        } }
      ]
    });
  }

  function onImportFile(event) {
    var file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast("Il file è troppo grande.");
      return;
    }
    var reader = new FileReader();
    reader.onerror = function () { toast("Non riesco a leggere il file."); };
    reader.onload = function () {
      var parsed;
      try {
        var text = String(reader.result || "").replace(/^\uFEFF/, "");
        parsed = JSON.parse(text);
      } catch (err) {
        toast("Il file non è un JSON valido.");
        return;
      }
      var checked = L.validateBackup(parsed);
      if (!checked.ok) {
        openDialog({
          title: "Backup non valido",
          body: checked.error,
          actions: [{ key: "cancel", label: "Chiudi", className: "btn btn-primary" }]
        });
        return;
      }
      askImport(checked.backup);
    };
    reader.readAsText(file, "UTF-8");
  }

  function readNumber(id, label) {
    var raw = $(id).value.trim().replace(",", ".");
    var n = Number(raw);
    if (!raw || !Number.isFinite(n) || n < 1 || n > 1000) {
      return { error: label + ": inserisci un numero fra 1 e 1000." };
    }
    return { value: L.roundOre(n) };
  }

  function onSaveSettings(event) {
    event.preventDefault();
    var err = $("settings-errore");
    err.hidden = true;
    var fields = [
      ["set-obb-diretto", "Obiettivo diretto", "obiettivoDiretto"],
      ["set-obb-indiretto", "Obiettivo indiretto", "obiettivoIndiretto"],
      ["set-lim-mese", "Limite mensile", "limiteMensile"],
      ["set-lim-sett", "Limite settimanale", "limiteSettimanale"]
    ];
    var next = Object.assign({}, state.impostazioni);
    for (var i = 0; i < fields.length; i++) {
      var read = readNumber(fields[i][0], fields[i][1]);
      if (read.error) {
        err.hidden = false;
        err.textContent = read.error;
        $(fields[i][0]).focus();
        return;
      }
      next[fields[i][2]] = read.value;
    }
    state.impostazioni = next;
    save();
    fillSettingsForm();
    renderDashboard();
    toast("Obiettivi e limiti salvati.");
  }

  function selectDay(iso) {
    if (!L.isValidISODate(iso)) return;
    state.selectedDay = iso;
    var d = L.parseISODate(iso);
    state.calYear = d.getFullYear();
    state.calMonth = d.getMonth();
    showView("calendario");
    renderCalendar();
    $("day-panel").scrollIntoView({ behavior: motion(), block: "nearest" });
  }

  function shiftMonth(delta) {
    var d = new Date(state.calYear, state.calMonth + delta, 1);
    state.calYear = d.getFullYear();
    state.calMonth = d.getMonth();
    if (state.selectedDay) {
      var sel = L.parseISODate(state.selectedDay);
      if (sel.getFullYear() !== state.calYear || sel.getMonth() !== state.calMonth) state.selectedDay = null;
    }
    renderCalendar();
  }

  function bind() {
    document.querySelectorAll(".tab[data-view]").forEach(function (tab) {
      tab.addEventListener("click", function () {
        if (tab.dataset.view === "attivita") {
          if (state.editingId || state.view === "attivita") showView("attivita");
          else startNew(L.todayISO());
          return;
        }
        showView(tab.dataset.view);
      });
    });
    $("btn-nuova").addEventListener("click", function () { startNew(L.todayISO()); });
    $("btn-impostazioni").addEventListener("click", function () { showView("impostazioni"); });
    document.body.addEventListener("click", function (event) {
      var target = event.target.closest("[data-action], [data-view]");
      if (!target || target.classList.contains("tab") || target.id === "btn-impostazioni") return;
      if (target.dataset.view) {
        showView(target.dataset.view);
        return;
      }
      var action = target.dataset.action;
      if (action === "nuova") startNew(L.todayISO());
      else if (action === "edit") editEntry(target.dataset.id);
      else if (action === "delete") confirmDelete(target.dataset.id);
      else if (action === "add-day") startNew(target.dataset.date);
      else if (action === "open-day") selectDay(target.dataset.date);
    });

    $("dalle").addEventListener("input", recomputeOre);
    $("alle").addEventListener("input", recomputeOre);
    $("ore").addEventListener("input", updateOreHint);
    $("form-attivita").addEventListener("submit", onSubmit);
    $("btn-annulla-modifica").addEventListener("click", function () {
      var back = state.selectedDay;
      resetForm(L.todayISO());
      showView(back ? "calendario" : "elenco");
    });
    $("btn-elimina-modifica").addEventListener("click", function () {
      if (state.editingId) confirmDelete(state.editingId);
    });

    $("cal-prev").addEventListener("click", function () { shiftMonth(-1); });
    $("cal-next").addEventListener("click", function () { shiftMonth(1); });
    $("cal-today").addEventListener("click", function () {
      var now = new Date();
      state.calYear = now.getFullYear();
      state.calMonth = now.getMonth();
      state.selectedDay = L.todayISO(now);
      renderCalendar();
    });

    $("filtro-mese").addEventListener("change", function (event) {
      state.filtroMese = event.target.value;
      renderList();
    });
    $("filtro-tipo").addEventListener("change", function (event) {
      state.filtroTipo = event.target.value;
      renderList();
    });
    $("filtro-ricerca").addEventListener("input", function (event) {
      state.ricerca = event.target.value;
      renderList();
    });

    document.querySelectorAll('input[name="stampa-tipo"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        if (!radio.checked) return;
        state.stampaTipo = radio.value;
        renderPrintTable();
      });
    });
    $("btn-stampa").addEventListener("click", function () {
      showView("stampa");
      renderPrintTable();
      window.print();
    });

    document.querySelectorAll("[data-setting]").forEach(function (el) {
      el.addEventListener("input", function () {
        state.impostazioni[el.dataset.setting] = el.value;
        save();
        renderHeader();
      });
      el.addEventListener("blur", function () {
        var max = Number(el.getAttribute("maxlength")) || 160;
        var clean = L.cleanLine(el.value, max);
        el.value = clean;
        state.impostazioni[el.dataset.setting] = clean;
        save();
        renderHeader();
      });
    });

    $("form-impostazioni").addEventListener("submit", onSaveSettings);
    $("btn-export").addEventListener("click", downloadBackup);
    $("btn-share").addEventListener("click", shareBackup);
    if (canShareFiles()) $("btn-share").hidden = false;
    $("import-file").addEventListener("change", onImportFile);

    $("dialog").addEventListener("click", function (event) {
      if (event.target === $("dialog")) closeDialog(true);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !$("dialog").hidden) closeDialog(true);
    });
    window.addEventListener("hashchange", function () {
      var view = parseHash();
      if (view !== state.view) showView(view, false);
    });
  }

  function countLabel(n) {
    return n === 1 ? "1 attività" : n + " attività";
  }

  function init() {
    if (!window.TirocinioLogic) throw new Error("Logica non caricata.");
    load();
    bind();
    fillPrintFields();
    fillSettingsForm();
    resetForm(L.todayISO());
    renderAll();
    showView(parseHash(), false);
    if (state.loadError) showBanner(state.loadError);
  }

  init();
})();
