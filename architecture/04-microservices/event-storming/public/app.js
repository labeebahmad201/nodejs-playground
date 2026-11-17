const STORAGE_KEY = "event-storming-board-v1";
const BOARD_WIDTH = 3200;
const BOARD_HEIGHT = 2000;
const NOTE_WIDTH = 224;

const NOTE_TYPES = [
  {
    id: "domain-event",
    label: "Domain event",
    short: "Event",
    hint: "A business fact, in past tense.",
    placeholder: "Order placed",
    color: "#ffb703",
  },
  {
    id: "command",
    label: "Command",
    short: "Command",
    hint: "An intent or decision to act.",
    placeholder: "Place order",
    color: "#4dabf7",
  },
  {
    id: "aggregate",
    label: "Aggregate",
    short: "Aggregate",
    hint: "The consistency boundary that decides.",
    placeholder: "Order",
    color: "#ffe066",
  },
  {
    id: "policy",
    label: "Policy",
    short: "Policy",
    hint: "When this happens, then that.",
    placeholder: "When order placed → reserve inventory",
    color: "#c9a7ff",
  },
  {
    id: "read-model",
    label: "Read model",
    short: "Read model",
    hint: "A view someone needs to make a decision.",
    placeholder: "Order summary",
    color: "#8ce99a",
  },
  {
    id: "person",
    label: "Person",
    short: "Person",
    hint: "A role that makes a decision.",
    placeholder: "Customer",
    color: "#ffd43b",
  },
  {
    id: "external-system",
    label: "External system",
    short: "External",
    hint: "Outside your boundary.",
    placeholder: "Payment provider",
    color: "#ffa8c0",
  },
  {
    id: "hotspot",
    label: "Hotspot",
    short: "Hotspot",
    hint: "A question, conflict, or unknown.",
    placeholder: "What if the response is lost?",
    color: "#ff8787",
  },
  {
    id: "opportunity",
    label: "Opportunity",
    short: "Opportunity",
    hint: "An idea that could improve the process.",
    placeholder: "Automate the reconciliation step",
    color: "#63e6be",
  },
  {
    id: "bounded-context",
    label: "Bounded context",
    short: "Context",
    hint: "A boundary where one language and model apply.",
    placeholder: "Payments",
    color: "#dee2e6",
  },
];

const TYPE_BY_ID = new Map(NOTE_TYPES.map((type) => [type.id, type]));

const SAMPLE_NOTES = [
  { type: "command", text: "Place order", x: 90, y: 150 },
  { type: "domain-event", text: "Order placed", x: 90, y: 300 },
  { type: "aggregate", text: "Order", x: 90, y: 470 },
  { type: "policy", text: "When order placed → reserve inventory", x: 390, y: 300 },
  { type: "command", text: "Reserve inventory", x: 390, y: 150 },
  { type: "domain-event", text: "Inventory reserved", x: 690, y: 300 },
  { type: "external-system", text: "Payment provider", x: 690, y: 470 },
  { type: "command", text: "Capture payment", x: 990, y: 150 },
  { type: "domain-event", text: "Payment captured", x: 990, y: 300 },
  {
    type: "hotspot",
    text: "Payment succeeded, but the response was lost. Now what?",
    x: 990,
    y: 470,
  },
  { type: "domain-event", text: "Payment unknown", x: 1290, y: 300 },
  {
    type: "policy",
    text: "When payment unknown → reconcile with provider",
    x: 1290,
    y: 470,
  },
  { type: "domain-event", text: "Order confirmed", x: 1590, y: 300 },
  { type: "read-model", text: "Order summary", x: 1590, y: 470 },
];

const viewport = must("#viewport");
const notesLayer = must("#notes-layer");
const palette = must("#palette");
const toastElement = must("#toast");

let notes = loadNotes();
let pan = null;
let toastTimer = 0;

function must(selector) {
  const element = document.querySelector(selector);

  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }

  return element;
}

function makeId() {
  return crypto.randomUUID?.() ?? `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function numberOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function makeSampleNotes() {
  return SAMPLE_NOTES.map((note) => ({
    ...note,
    id: makeId(),
  }));
}

function normalizeNotes(input) {
  if (!Array.isArray(input)) {
    throw new Error("Board data must contain an array of notes.");
  }

  const seenIds = new Set();

  return input.map((raw, index) => {
    const type = TYPE_BY_ID.has(raw?.type) ? raw.type : "domain-event";
    let id = typeof raw?.id === "string" && raw.id ? raw.id : makeId();

    if (seenIds.has(id)) {
      id = makeId();
    }

    seenIds.add(id);

    return {
      id,
      type,
      text: typeof raw?.text === "string" ? raw.text : "",
      x: clamp(numberOr(raw?.x, 90 + (index % 6) * 260), 0, BOARD_WIDTH - NOTE_WIDTH),
      y: clamp(numberOr(raw?.y, 120 + Math.floor(index / 6) * 180), 0, BOARD_HEIGHT - 160),
    };
  });
}

function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw === null) {
      return makeSampleNotes();
    }

    const parsed = JSON.parse(raw);
    return normalizeNotes(Array.isArray(parsed) ? parsed : parsed?.notes);
  } catch (error) {
    console.warn("Could not load the saved board.", error);
    return makeSampleNotes();
  }
}

function saveNotes() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (error) {
    console.warn("Could not save the board.", error);
  }
}

function showToast(message) {
  toastElement.textContent = message;
  toastElement.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastElement.classList.remove("is-visible");
  }, 2400);
}

function renderPalette() {
  const fragment = document.createDocumentFragment();

  for (const type of NOTE_TYPES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "palette__item";
    button.style.setProperty("--swatch", type.color);
    button.innerHTML = `
      <span class="palette__swatch" aria-hidden="true"></span>
      <span>
        <span class="palette__label"></span>
        <span class="palette__hint"></span>
      </span>
    `;
    button.querySelector(".palette__label").textContent = type.label;
    button.querySelector(".palette__hint").textContent = type.hint;
    button.addEventListener("click", () => addNote(type.id));
    fragment.append(button);
  }

  palette.replaceChildren(fragment);
}

function renderNotes() {
  const fragment = document.createDocumentFragment();

  for (const note of notes) {
    fragment.append(createNoteElement(note));
  }

  notesLayer.replaceChildren(fragment);
  resizeAllTextareas();
}

function createNoteElement(note) {
  const type = TYPE_BY_ID.get(note.type) ?? TYPE_BY_ID.get("domain-event");
  const element = document.createElement("article");
  element.className = "note";
  element.dataset.id = note.id;
  element.dataset.type = note.type;
  element.style.left = `${note.x}px`;
  element.style.top = `${note.y}px`;

  const header = document.createElement("div");
  header.className = "note__header";

  const badge = document.createElement("button");
  badge.type = "button";
  badge.className = "note__badge";
  badge.textContent = type.short;
  badge.title = `${type.label}: ${type.hint} Click to change.`;
  badge.addEventListener("click", (event) => {
    event.stopPropagation();
    cycleType(note, element, badge, text);
  });

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "note__remove";
  remove.textContent = "×";
  remove.title = "Delete note";
  remove.setAttribute("aria-label", "Delete note");
  remove.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteNote(note);
  });

  header.append(badge, remove);

  const text = document.createElement("textarea");
  text.className = "note__text";
  text.value = note.text;
  text.placeholder = type.placeholder;
  text.setAttribute("aria-label", `${type.label} text`);
  text.spellcheck = true;

  text.addEventListener("input", () => {
    note.text = text.value;
    resizeTextarea(text);
    saveNotes();
  });

  text.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      text.blur();
    }
  });

  header.addEventListener("pointerdown", (event) => {
    if (event.target instanceof Element && event.target.closest("button")) {
      return;
    }

    startDrag(event, note, element);
  });

  element.addEventListener("dblclick", () => text.focus());
  element.append(header, text);

  return element;
}

function resizeTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.max(82, textarea.scrollHeight)}px`;
}

function resizeAllTextareas() {
  for (const textarea of notesLayer.querySelectorAll(".note__text")) {
    resizeTextarea(textarea);
  }
}

function findNoteTextarea(id) {
  for (const noteElement of notesLayer.querySelectorAll(".note")) {
    if (noteElement.dataset.id === id) {
      return noteElement.querySelector(".note__text");
    }
  }

  return null;
}

function addNote(typeId) {
  const type = TYPE_BY_ID.get(typeId) ?? TYPE_BY_ID.get("domain-event");
  const x = clamp(
    viewport.scrollLeft + viewport.clientWidth / 2 - NOTE_WIDTH / 2,
    0,
    BOARD_WIDTH - NOTE_WIDTH,
  );
  const y = clamp(
    viewport.scrollTop + viewport.clientHeight / 2 - 70,
    0,
    BOARD_HEIGHT - 160,
  );

  const note = {
    id: makeId(),
    type: type.id,
    text: "",
    x,
    y,
  };

  notes.push(note);
  saveNotes();
  renderNotes();

  const textarea = findNoteTextarea(note.id);

  if (textarea instanceof HTMLTextAreaElement) {
    textarea.focus();
  }

  showToast(`Added a ${type.label.toLowerCase()}.`);
}

function deleteNote(note) {
  const index = notes.indexOf(note);

  if (index === -1) {
    return;
  }

  notes.splice(index, 1);
  saveNotes();
  renderNotes();
  showToast("Note deleted.");
}

function cycleType(note, element, badge, textarea) {
  const currentIndex = NOTE_TYPES.findIndex((type) => type.id === note.type);
  const nextType = NOTE_TYPES[(currentIndex + 1) % NOTE_TYPES.length];

  note.type = nextType.id;
  element.dataset.type = nextType.id;
  badge.textContent = nextType.short;
  badge.title = `${nextType.label}: ${nextType.hint} Click to change.`;
  textarea.placeholder = nextType.placeholder;
  saveNotes();
}

function startDrag(event, note, element) {
  if (event.button !== 0) {
    return;
  }

  event.preventDefault();

  const startX = event.clientX;
  const startY = event.clientY;
  const originalX = note.x;
  const originalY = note.y;

  element.classList.add("is-dragging");
  document.body.classList.add("is-dragging");

  const onMove = (moveEvent) => {
    note.x = clamp(originalX + moveEvent.clientX - startX, 0, BOARD_WIDTH - element.offsetWidth);
    note.y = clamp(
      originalY + moveEvent.clientY - startY,
      0,
      BOARD_HEIGHT - element.offsetHeight,
    );
    element.style.left = `${note.x}px`;
    element.style.top = `${note.y}px`;
  };

  const onEnd = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onEnd);
    window.removeEventListener("pointercancel", onEnd);
    element.classList.remove("is-dragging");
    document.body.classList.remove("is-dragging");
    saveNotes();
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onEnd);
  window.addEventListener("pointercancel", onEnd);
}

function startPan(event) {
  if (event.button !== 0 || !(event.target instanceof Element) || event.target.closest(".note")) {
    return;
  }

  pan = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    scrollLeft: viewport.scrollLeft,
    scrollTop: viewport.scrollTop,
  };

  viewport.setPointerCapture(event.pointerId);
  viewport.classList.add("is-panning");
  event.preventDefault();
}

function movePan(event) {
  if (!pan || event.pointerId !== pan.pointerId) {
    return;
  }

  viewport.scrollLeft = pan.scrollLeft - (event.clientX - pan.x);
  viewport.scrollTop = pan.scrollTop - (event.clientY - pan.y);
}

function endPan(event) {
  if (!pan || event.pointerId !== pan.pointerId) {
    return;
  }

  pan = null;
  viewport.classList.remove("is-panning");
}

function download(filename, contents, type) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toJson() {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      notes,
    },
    null,
    2,
  );
}

function toMarkdown() {
  const lines = [
    "# Event Storming Board",
    "",
    `Exported: ${new Date().toISOString()}`,
    "",
  ];

  for (const type of NOTE_TYPES) {
    const group = notes.filter((note) => note.type === type.id);

    if (group.length === 0) {
      continue;
    }

    lines.push(`## ${type.label}`, "");

    for (const note of group) {
      lines.push(`- ${note.text.replace(/\n/g, " ")}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

function toAiPrompt() {
  const lines = [
    "You are reviewing an Event Storming board for a software architecture discussion.",
    "",
    "Here is the board:",
    "",
  ];

  for (const type of NOTE_TYPES) {
    const group = notes.filter((note) => note.type === type.id);

    if (group.length === 0) {
      continue;
    }

    lines.push(`${type.label}:`);

    for (const note of group) {
      lines.push(`- ${note.text.replace(/\n/g, " ")}`);
    }

    lines.push("");
  }

  lines.push(
    "Review this board as a domain expert and a software architect.",
    "1. Point out notes that are not actually domain events.",
    "2. Identify missing events, commands, policies, external systems, and hotspots.",
    "3. Flag ambiguous terms, conflicting ownership, and duplicate concepts.",
    "4. Propose candidate bounded contexts or service boundaries, with evidence from the board.",
    "5. List the top 10 questions to ask the business.",
    "",
    "Do not invent facts. Mark every assumption explicitly.",
  );

  return lines.join("\n");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard.");
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();

    const copied = document.execCommand("copy");
    area.remove();
    showToast(copied ? "Copied to clipboard." : "Could not copy automatically.");
  }
}

function importNotes(file) {
  file
    .text()
    .then((contents) => {
      const parsed = JSON.parse(contents);
      notes = normalizeNotes(Array.isArray(parsed) ? parsed : parsed?.notes);
      saveNotes();
      renderNotes();
      showToast("Board imported.");
    })
    .catch((error) => {
      console.warn("Could not import the board.", error);
      showToast("Could not import that JSON file.");
    });
}

function clearBoard() {
  if (notes.length === 0) {
    showToast("The board is already empty.");
    return;
  }

  if (!window.confirm("Clear every note from the board? This cannot be undone.")) {
    return;
  }

  notes = [];
  saveNotes();
  renderNotes();
  showToast("Board cleared.");
}

function init() {
  renderPalette();
  renderNotes();

  viewport.addEventListener("pointerdown", startPan);
  viewport.addEventListener("pointermove", movePan);
  viewport.addEventListener("pointerup", endPan);
  viewport.addEventListener("pointercancel", endPan);

  must("#export-json").addEventListener("click", () => {
    download("event-storming-board.json", toJson(), "application/json");
    showToast("JSON exported.");
  });

  must("#export-md").addEventListener("click", () => {
    download("event-storming-board.md", toMarkdown(), "text/markdown");
    showToast("Markdown exported.");
  });

  must("#copy-prompt").addEventListener("click", () => {
    copyText(toAiPrompt());
  });

  must("#clear-board").addEventListener("click", clearBoard);

  const importInput = must("#import-json");

  if (importInput instanceof HTMLInputElement) {
    importInput.addEventListener("change", () => {
      const file = importInput.files?.[0];

      if (file) {
        importNotes(file);
      }

      importInput.value = "";
    });
  }
}

init();
