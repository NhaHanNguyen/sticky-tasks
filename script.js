(() => {
  const board = document.getElementById("board");
  const form = document.getElementById("noteForm");
  const input = document.getElementById("taskInput");
  const trashWrap = document.getElementById("trashWrap");
  const trashZone = document.getElementById("trashZone");
  const emptyState = document.getElementById("emptyState");
  const toast = document.getElementById("toast");

  const STORAGE_KEY = "sticky-task-board-v1";
  const HOLD_MS = 260;
  const colors = ["1", "2", "3", "4", "5"];

  let notes = [];
  let drag = null;
  let zCounter = 20;
  let toastTimer = null;

  function makeId() {
    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return String(Date.now() + Math.random());
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

      if (Array.isArray(saved)) {
        notes = saved;
      }
    } catch {
      notes = [];
    }

    if (!notes.length) {
      notes = [
        {
          id: makeId(),
          text: "Drag me around ✨",
          x: 90,
          y: 72,
          rotation: -2,
          color: "1",
          z: 1
        },
        {
          id: makeId(),
          text: "Hold me, then throw me in the trash 🗑️",
          x: 320,
          y: 160,
          rotation: 2,
          color: "3",
          z: 2
        }
      ];
    }

    renderAll();
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 1300);
  }

  function updateEmptyState() {
    emptyState.style.opacity = notes.length ? "0" : "1";
  }

  function noteSize() {
    if (window.matchMedia("(max-width: 620px)").matches) {
      return { w: 160, h: 140 };
    }

    return { w: 190, h: 160 };
  }

  function clampPosition(x, y) {
    const rect = board.getBoundingClientRect();
    const size = noteSize();

    const maxX = Math.max(8, rect.width - size.w - 8);
    const maxY = Math.max(8, rect.height - size.h - 8);

    return {
      x: Math.max(8, Math.min(x, maxX)),
      y: Math.max(8, Math.min(y, maxY))
    };
  }

  function renderAll() {
    board.querySelectorAll(".sticky").forEach((element) => {
      element.remove();
    });

    for (const note of notes) {
      renderNote(note);
    }

    updateEmptyState();
  }

  function renderNote(note) {
    const pos = clampPosition(
      Number(note.x) || 8,
      Number(note.y) || 8
    );

    note.x = pos.x;
    note.y = pos.y;

    const element = document.createElement("button");

    element.type = "button";
    element.className = "sticky";
    element.dataset.id = note.id;
    element.dataset.color = note.color || "1";
    element.style.left = note.x + "px";
    element.style.top = note.y + "px";
    element.style.zIndex = String(note.z || 1);
    element.style.setProperty(
      "--rotation",
      (Number(note.rotation) || 0) + "deg"
    );

    element.setAttribute(
      "aria-label",
      `${note.text}. Press and hold to drag. Press Delete or Backspace while focused to remove.`
    );

    const text = document.createElement("span");
    text.className = "task-text";
    text.textContent = note.text;

    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = "hold + drag";

    element.append(text, hint);
    board.appendChild(element);

    element.addEventListener("pointerdown", startHold);
    element.addEventListener("pointermove", movePointer);
    element.addEventListener("pointerup", endPointer);
    element.addEventListener("pointercancel", cancelPointer);

    element.addEventListener("keydown", (event) => {
      if (
        event.key === "Delete" ||
        event.key === "Backspace"
      ) {
        event.preventDefault();
        deleteNote(note.id, element);
      }
    });
  }

  function startHold(event) {
    if (
      event.button !== undefined &&
      event.button !== 0
    ) {
      return;
    }

    const element = event.currentTarget;

    const note = notes.find((item) => {
      return item.id === element.dataset.id;
    });

    if (!note) {
      return;
    }

    const boardRect = board.getBoundingClientRect();

    drag = {
      id: note.id,
      element,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      offsetX:
        event.clientX -
        boardRect.left -
        note.x,
      offsetY:
        event.clientY -
        boardRect.top -
        note.y,
      active: false,
      moved: false,
      timer: null
    };

    element.setPointerCapture?.(event.pointerId);

    drag.timer = setTimeout(() => {
      if (!drag || drag.id !== note.id) {
        return;
      }

      drag.active = true;
      zCounter += 1;
      note.z = zCounter;

      element.style.zIndex = String(zCounter);
      element.classList.add("holding", "primed");

      if (navigator.vibrate) {
        navigator.vibrate(18);
      }

      setTimeout(() => {
        element.classList.remove("primed");
      }, 220);
    }, HOLD_MS);
  }

  function movePointer(event) {
    if (
      !drag ||
      event.pointerId !== drag.pointerId
    ) {
      return;
    }

    const distance = Math.hypot(
      event.clientX - drag.startClientX,
      event.clientY - drag.startClientY
    );

    if (!drag.active && distance > 9) {
      clearTimeout(drag.timer);
      cancelPointer();
      return;
    }

    if (!drag.active) {
      return;
    }

    event.preventDefault();
    drag.moved = true;

    const boardRect = board.getBoundingClientRect();

    const note = notes.find((item) => {
      return item.id === drag.id;
    });

    if (!note) {
      return;
    }

    const next = clampPosition(
      event.clientX -
        boardRect.left -
        drag.offsetX,
      event.clientY -
        boardRect.top -
        drag.offsetY
    );

    note.x = next.x;
    note.y = next.y;

    drag.element.style.left = next.x + "px";
    drag.element.style.top = next.y + "px";

    const overTrash = isOverTrash(drag.element);
    trashWrap.classList.toggle("active", overTrash);
  }

  function endPointer(event) {
    if (
      !drag ||
      event.pointerId !== drag.pointerId
    ) {
      return;
    }

    clearTimeout(drag.timer);

    if (drag.active) {
      const overTrash = isOverTrash(drag.element);

      drag.element.classList.remove(
        "holding",
        "primed"
      );

      trashWrap.classList.remove("active");

      if (overTrash) {
        const id = drag.id;
        const element = drag.element;

        drag = null;
        deleteNote(id, element);
        return;
      }

      save();
    }

    drag.element.releasePointerCapture?.(
      event.pointerId
    );

    drag = null;
  }

  function cancelPointer() {
    if (!drag) {
      return;
    }

    clearTimeout(drag.timer);

    drag.element.classList.remove(
      "holding",
      "primed"
    );

    trashWrap.classList.remove("active");

    try {
      drag.element.releasePointerCapture?.(
        drag.pointerId
      );
    } catch {
      // Nothing needed here.
    }

    drag = null;
  }

  function isOverTrash(noteElement) {
    const noteRect =
      noteElement.getBoundingClientRect();

    const trashRect =
      trashZone.getBoundingClientRect();

    const centerX =
      noteRect.left + noteRect.width / 2;

    const centerY =
      noteRect.top + noteRect.height / 2;

    return (
      centerX >= trashRect.left - 15 &&
      centerX <= trashRect.right + 15 &&
      centerY >= trashRect.top - 15 &&
      centerY <= trashRect.bottom + 15
    );
  }

  function deleteNote(id, element) {
    const index = notes.findIndex((note) => {
      return note.id === id;
    });

    if (index === -1) {
      return;
    }

    notes.splice(index, 1);
    save();

    element.classList.add("deleting");

    showToast("Task thrown away");

    setTimeout(() => {
      element.remove();
      updateEmptyState();
    }, 330);
  }

  function addNote(text) {
    const clean = text.trim();

    if (!clean) {
      input.focus();
      return;
    }

    const rect = board.getBoundingClientRect();
    const size = noteSize();

    const randomRange = Math.max(
      40,
      rect.width - size.w - 170
    );

    const x = Math.max(
      110,
      Math.min(
        rect.width - size.w - 20,
        70 + Math.random() * randomRange
      )
    );

    const maxY = Math.max(
      60,
      rect.height - size.h - 30
    );

    zCounter += 1;

    const note = {
      id: makeId(),
      text: clean,
      x,
      y: Math.max(
        25,
        Math.min(
          maxY,
          35 +
            Math.random() *
              Math.max(30, maxY - 35)
        )
      ),
      rotation:
        Math.round(
          (Math.random() * 5 - 2.5) * 10
        ) / 10,
      color:
        colors[
          Math.floor(Math.random() * colors.length)
        ],
      z: zCounter
    };

    notes.push(note);
    save();
    renderNote(note);
    updateEmptyState();
    showToast("Sticky note added");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    addNote(input.value);

    input.value = "";
    input.focus();
  });

  window.addEventListener("resize", () => {
    for (const note of notes) {
      const pos = clampPosition(
        note.x,
        note.y
      );

      note.x = pos.x;
      note.y = pos.y;

      const element = board.querySelector(
        `.sticky[data-id="${CSS.escape(note.id)}"]`
      );

      if (element) {
        element.style.left = note.x + "px";
        element.style.top = note.y + "px";
      }
    }

    save();
  });

  load();
})();