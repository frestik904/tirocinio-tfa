/* Logica pura del quaderno: date, ore, filtri, backup. Nessun DOM. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TirocinioLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var MESI = Object.freeze([
    "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
    "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"
  ]);
  var GIORNI = Object.freeze([
    "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"
  ]);
  var GIORNI_BREVI = Object.freeze(["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]);
  var SETTING_KEYS = Object.freeze([
    "nomeCorsista", "scuola", "tutorScolastico", "tutorCoordinatore",
    "annoAccademico", "obiettivoDiretto", "obiettivoIndiretto",
    "limiteMensile", "limiteSettimanale"
  ]);
  var TEXT_LIMITS = {
    nomeCorsista: 120,
    scuola: 160,
    tutorScolastico: 120,
    tutorCoordinatore: 120,
    annoAccademico: 20
  };

  function roundOre(n) {
    return Math.round(Number(n) * 100) / 100;
  }

  function defaultSettings(now) {
    var date = now || new Date();
    return {
      nomeCorsista: "Riccardo Cerruto",
      scuola: "",
      tutorScolastico: "",
      tutorCoordinatore: "",
      annoAccademico: academicYear(date),
      obiettivoDiretto: 150,
      obiettivoIndiretto: 25,
      limiteMensile: 30,
      limiteSettimanale: 18
    };
  }

  function academicYear(date) {
    var y = date.getFullYear();
    var start = date.getMonth() >= 8 ? y : y - 1;
    return start + "/" + (start + 1);
  }

  function todayISO(now) {
    return toISODate(now || new Date());
  }

  function toISODate(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return "";
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function parseISODate(iso) {
    var parts = String(iso || "").split("-");
    if (parts.length !== 3) return new Date(NaN);
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function isValidISODate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return false;
    return toISODate(parseISODate(iso)) === iso;
  }

  function addDays(date, n) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + n);
    return d;
  }

  function startOfWeek(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var day = d.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  }

  function weekdayIndex(date) {
    return (date.getDay() + 6) % 7;
  }

  function formatDateIT(iso) {
    if (!isValidISODate(iso)) return "";
    var p = iso.split("-");
    return p[2] + "/" + p[1] + "/" + p[0];
  }

  function formatDateLong(iso) {
    var d = parseISODate(iso);
    if (isNaN(d.getTime())) return "";
    return GIORNI[weekdayIndex(d)] + " " + d.getDate() + " " + MESI[d.getMonth()] + " " + d.getFullYear();
  }

  function capitalize(s) {
    if (!s) return "";
    return s.charAt(0).toLocaleUpperCase("it") + s.slice(1);
  }

  function formatMonth(key) {
    var parts = String(key || "").split("-");
    if (parts.length !== 2) return String(key || "");
    var y = Number(parts[0]);
    var m = Number(parts[1]);
    if (!y || m < 1 || m > 12) return String(key);
    return capitalize(MESI[m - 1]) + " " + y;
  }

  function formatWeekRange(start, end) {
    var sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    if (sameMonth) {
      return start.getDate() + "–" + end.getDate() + " " + MESI[start.getMonth()] + " " + start.getFullYear();
    }
    var rightYear = start.getFullYear() === end.getFullYear() ? "" : " " + start.getFullYear();
    return start.getDate() + " " + MESI[start.getMonth()] + rightYear + " – " +
      end.getDate() + " " + MESI[end.getMonth()] + " " + end.getFullYear();
  }

  function monthKeyFromDate(date) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
  }

  function currentMonthKey(now) {
    return monthKeyFromDate(now || new Date());
  }

  function normalizeTime(value) {
    if (value == null) return null;
    var match = String(value).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) return null;
    var h = Number(match[1]);
    var min = Number(match[2]);
    if (h > 23 || min > 59) return null;
    return String(h).padStart(2, "0") + ":" + String(min).padStart(2, "0");
  }

  function timeToMinutes(value) {
    var t = normalizeTime(value);
    if (!t) return null;
    var parts = t.split(":");
    return Number(parts[0]) * 60 + Number(parts[1]);
  }

  function hoursBetween(dalle, alle) {
    var a = timeToMinutes(dalle);
    var b = timeToMinutes(alle);
    if (a == null || b == null || b <= a) return null;
    return roundOre((b - a) / 60);
  }

  function formatOre(n) {
    if (!Number.isFinite(Number(n))) return "0";
    var s = roundOre(n).toFixed(2);
    s = s.replace(/0+$/, "").replace(/\.$/, "");
    return s.replace(".", ",");
  }

  function formatOreLunghe(n) {
    if (!Number.isFinite(Number(n))) return "0 minuti";
    var totalMin = Math.round(roundOre(n) * 60);
    var h = Math.floor(totalMin / 60);
    var m = totalMin % 60;
    var hs = h === 1 ? "1 ora" : h + " ore";
    var ms = m === 1 ? "1 minuto" : m + " minuti";
    if (h === 0) return ms;
    if (m === 0) return hs;
    return hs + " e " + ms;
  }

  function parseOre(value) {
    if (value == null) return null;
    var s = String(value).trim().replace(",", ".");
    if (!s) return null;
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    var n = Number(s);
    if (!Number.isFinite(n) || n < 0 || n > 24) return null;
    return roundOre(n);
  }

  function oreToMinutes(ore) {
    return Math.round(roundOre(ore) * 60);
  }

  function sumOre(entries) {
    var mins = 0;
    for (var i = 0; i < entries.length; i++) mins += oreToMinutes(entries[i].ore);
    return roundOre(mins / 60);
  }

  function sumByTipo(entries) {
    var diretto = [];
    var indiretto = [];
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].tipo === "indiretto") indiretto.push(entries[i]);
      else diretto.push(entries[i]);
    }
    var oreDiretto = sumOre(diretto);
    var oreIndiretto = sumOre(indiretto);
    return {
      diretto: oreDiretto,
      indiretto: oreIndiretto,
      totale: roundOre((oreToMinutes(oreDiretto) + oreToMinutes(oreIndiretto)) / 60)
    };
  }

  function isOver(value, limit) {
    return roundOre(value) - roundOre(limit) > 0.001;
  }

  function cleanText(value, max) {
    if (value == null) return "";
    var s = String(value).replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
    if (s.length > max) s = s.slice(0, max);
    return s;
  }

  function cleanLine(value, max) {
    return cleanText(value, max).replace(/[\r\n]+/g, " ").replace(/[ \t]{2,}/g, " ").trim();
  }

  function cleanId(value) {
    if (value == null || (typeof value !== "string" && typeof value !== "number")) return "";
    var s = String(value).trim();
    if (!s || s.length > 80 || /[\s\u0000-\u001f]/.test(s)) return "";
    return s;
  }

  function newId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function pickSettings(raw) {
    var out = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
    for (var i = 0; i < SETTING_KEYS.length; i++) {
      var key = SETTING_KEYS[i];
      if (Object.prototype.hasOwnProperty.call(raw, key)) out[key] = raw[key];
    }
    return out;
  }

  function clampNumber(value, fallback, min, max) {
    var n = typeof value === "string" ? Number(String(value).replace(",", ".")) : Number(value);
    if (!Number.isFinite(n)) return fallback;
    n = roundOre(n);
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  function normalizeSettings(raw, now) {
    var base = defaultSettings(now);
    var picked = pickSettings(raw);
    var s = {
      nomeCorsista: base.nomeCorsista,
      scuola: base.scuola,
      tutorScolastico: base.tutorScolastico,
      tutorCoordinatore: base.tutorCoordinatore,
      annoAccademico: base.annoAccademico,
      obiettivoDiretto: base.obiettivoDiretto,
      obiettivoIndiretto: base.obiettivoIndiretto,
      limiteMensile: base.limiteMensile,
      limiteSettimanale: base.limiteSettimanale
    };
    var textKeys = ["nomeCorsista", "scuola", "tutorScolastico", "tutorCoordinatore", "annoAccademico"];
    for (var i = 0; i < textKeys.length; i++) {
      var key = textKeys[i];
      if (Object.prototype.hasOwnProperty.call(picked, key)) {
        s[key] = cleanLine(picked[key], TEXT_LIMITS[key]);
      }
    }
    if (Object.prototype.hasOwnProperty.call(picked, "obiettivoDiretto")) {
      s.obiettivoDiretto = clampNumber(picked.obiettivoDiretto, base.obiettivoDiretto, 1, 1000);
    }
    if (Object.prototype.hasOwnProperty.call(picked, "obiettivoIndiretto")) {
      s.obiettivoIndiretto = clampNumber(picked.obiettivoIndiretto, base.obiettivoIndiretto, 1, 1000);
    }
    if (Object.prototype.hasOwnProperty.call(picked, "limiteMensile")) {
      s.limiteMensile = clampNumber(picked.limiteMensile, base.limiteMensile, 1, 1000);
    }
    if (Object.prototype.hasOwnProperty.call(picked, "limiteSettimanale")) {
      s.limiteSettimanale = clampNumber(picked.limiteSettimanale, base.limiteSettimanale, 1, 1000);
    }
    return s;
  }

  function normalizeEntry(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { ok: false, error: "Voce non valida." };
    }
    var data = cleanLine(raw.data, 10);
    if (!isValidISODate(data)) return { ok: false, error: "Data non valida." };
    var dalle = normalizeTime(raw.dalle);
    var alle = normalizeTime(raw.alle);
    if (!dalle || !alle) return { ok: false, error: "Orario non valido." };
    if (timeToMinutes(alle) <= timeToMinutes(dalle)) {
      return { ok: false, error: "L'orario di fine deve essere successivo all'inizio." };
    }
    var ore = null;
    if (raw.ore === "" || raw.ore == null) ore = hoursBetween(dalle, alle);
    else ore = parseOre(raw.ore);
    if (ore == null || ore <= 0) return { ok: false, error: "Ore non valide." };
    var tipo = cleanLine(raw.tipo, 20).toLocaleLowerCase("it");
    if (tipo !== "diretto" && tipo !== "indiretto") return { ok: false, error: "Tipo non valido." };
    var attivita = raw.attivita != null ? raw.attivita : raw["attività"];
    return {
      ok: true,
      entry: {
        id: cleanId(raw.id) || newId(),
        data: data,
        dalle: dalle,
        alle: alle,
        ore: ore,
        tipo: tipo,
        scuola: cleanLine(raw.scuola, 160),
        classe: cleanLine(raw.classe, 40),
        attivita: cleanText(attivita, 4000),
        note: cleanText(raw.note, 2000)
      }
    };
  }

  function mergeEntries(localEntries, incoming) {
    var map = new Map();
    var i;
    for (i = 0; i < localEntries.length; i++) map.set(localEntries[i].id, localEntries[i]);
    for (i = 0; i < incoming.length; i++) map.set(incoming[i].id, incoming[i]);
    return Array.from(map.values());
  }

  function validateBackup(data) {
    var entriesRaw = null;
    var settingsRaw = null;
    if (Array.isArray(data)) {
      entriesRaw = data;
    } else if (data && typeof data === "object" && Array.isArray(data.attivita)) {
      entriesRaw = data.attivita;
      if (data.impostazioni && typeof data.impostazioni === "object" && !Array.isArray(data.impostazioni)) {
        settingsRaw = pickSettings(data.impostazioni);
      }
    } else {
      return { ok: false, error: "Il file non contiene un elenco di attività." };
    }
    if (entriesRaw.length > 5000) {
      return { ok: false, error: "Il file contiene troppe attività (massimo 5000)." };
    }
    var attivita = [];
    for (var i = 0; i < entriesRaw.length; i++) {
      var normalized = normalizeEntry(entriesRaw[i]);
      if (!normalized.ok) {
        return { ok: false, error: "Voce " + (i + 1) + ": " + normalized.error };
      }
      attivita.push(normalized.entry);
    }
    var esportatoIl = data && typeof data.esportatoIl === "string" ? data.esportatoIl : null;
    return {
      ok: true,
      backup: {
        versione: 1,
        esportatoIl: esportatoIl,
        impostazioni: settingsRaw,
        attivita: mergeEntries([], attivita)
      }
    };
  }

  function fold(value) {
    return String(value || "")
      .toLocaleLowerCase("it")
      .replace(/[àáâä]/g, "a")
      .replace(/[èéêë]/g, "e")
      .replace(/[ìíîï]/g, "i")
      .replace(/[òóôö]/g, "o")
      .replace(/[ùúûü]/g, "u");
  }

  function filterEntries(entries, criteria) {
    var opts = criteria || {};
    var mese = opts.mese || "";
    var tipo = opts.tipo || "";
    var q = fold(opts.ricerca || "").trim();
    var out = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (mese && e.data.slice(0, 7) !== mese) continue;
      if (tipo && e.tipo !== tipo) continue;
      if (q) {
        var hay = fold([
          e.attivita, e.note, e.scuola, e.classe, e.tipo,
          formatDateIT(e.data), e.dalle, e.alle, formatOre(e.ore)
        ].join(" "));
        if (hay.indexOf(q) === -1) continue;
      }
      out.push(e);
    }
    return out;
  }

  function compareEntriesAsc(a, b) {
    if (a.data !== b.data) return a.data < b.data ? -1 : 1;
    if (a.dalle !== b.dalle) return a.dalle < b.dalle ? -1 : 1;
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return 0;
  }

  function buildMonthGrid(year, monthIndex) {
    var first = new Date(year, monthIndex, 1);
    var startOffset = weekdayIndex(first);
    var daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    var cells = [];
    var i;
    for (i = 0; i < startOffset; i++) cells.push(null);
    for (var d = 1; d <= daysInMonth; d++) {
      var date = new Date(year, monthIndex, d);
      cells.push({ date: date, iso: toISODate(date) });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function weeksOverlappingMonth(year, monthIndex, entries) {
    var first = new Date(year, monthIndex, 1);
    var last = new Date(year, monthIndex + 1, 0);
    var cursor = startOfWeek(first);
    var lastWeek = startOfWeek(last);
    var weeks = [];
    var guard = 0;
    while (cursor.getTime() <= lastWeek.getTime() && guard < 8) {
      var start = new Date(cursor.getTime());
      var end = addDays(start, 6);
      var startISO = toISODate(start);
      var endISO = toISODate(end);
      var inWeek = [];
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].data >= startISO && entries[i].data <= endISO) inWeek.push(entries[i]);
      }
      var monthStartISO = toISODate(first);
      var monthEndISO = toISODate(last);
      weeks.push({
        start: start,
        end: end,
        startISO: startISO,
        endISO: endISO,
        spansOutside: startISO < monthStartISO || endISO > monthEndISO,
        entries: inWeek
      });
      cursor = addDays(cursor, 7);
      guard += 1;
    }
    return weeks;
  }

  function monthsInEntries(entries) {
    var set = Object.create(null);
    for (var i = 0; i < entries.length; i++) set[entries[i].data.slice(0, 7)] = true;
    return Object.keys(set).sort();
  }

  function entriesOnDate(entries, iso) {
    var out = [];
    for (var i = 0; i < entries.length; i++) if (entries[i].data === iso) out.push(entries[i]);
    out.sort(compareEntriesAsc);
    return out;
  }

  function tipoLabel(tipo) {
    return tipo === "indiretto" ? "Indiretto" : "Diretto";
  }

  return {
    MESI: MESI,
    GIORNI: GIORNI,
    GIORNI_BREVI: GIORNI_BREVI,
    SETTING_KEYS: SETTING_KEYS,
    roundOre: roundOre,
    defaultSettings: defaultSettings,
    academicYear: academicYear,
    todayISO: todayISO,
    toISODate: toISODate,
    parseISODate: parseISODate,
    isValidISODate: isValidISODate,
    addDays: addDays,
    startOfWeek: startOfWeek,
    formatDateIT: formatDateIT,
    formatDateLong: formatDateLong,
    formatMonth: formatMonth,
    formatWeekRange: formatWeekRange,
    currentMonthKey: currentMonthKey,
    monthKeyFromDate: monthKeyFromDate,
    normalizeTime: normalizeTime,
    hoursBetween: hoursBetween,
    formatOre: formatOre,
    formatOreLunghe: formatOreLunghe,
    parseOre: parseOre,
    sumOre: sumOre,
    sumByTipo: sumByTipo,
    isOver: isOver,
    cleanText: cleanText,
    cleanLine: cleanLine,
    newId: newId,
    normalizeSettings: normalizeSettings,
    normalizeEntry: normalizeEntry,
    mergeEntries: mergeEntries,
    validateBackup: validateBackup,
    fold: fold,
    filterEntries: filterEntries,
    compareEntriesAsc: compareEntriesAsc,
    buildMonthGrid: buildMonthGrid,
    weeksOverlappingMonth: weeksOverlappingMonth,
    monthsInEntries: monthsInEntries,
    entriesOnDate: entriesOnDate,
    tipoLabel: tipoLabel,
    pickSettings: pickSettings
  };
});
