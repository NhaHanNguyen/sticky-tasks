(() => {
  const board = document.getElementById("board");
  const form = document.getElementById("noteForm");
  const input = document.getElementById("taskInput");
  const trashWrap = document.getElementById("trashWrap");
  const trashZone = document.getElementById("trashZone");
  const emptyState = document.getElementById("emptyState");
  const toast = document.getElementById("toast");
  const trashCountEl = document.getElementById("trashCount");
  const colorDots = Array.from(document.querySelectorAll(".color-dot"));

  const STORAGE_KEY = "sticky-task-board-v1";
  const TRASH_COUNT_KEY = "sticky-task-board-trash-count-v1";
  const HOLD_MS = 110;

  let notes = [];
  let trashCount = 0;
  let selectedColor = "1";
  let drag = null;
  let zCounter = 20;
  let toastTimer = null;

  /* create unique id */
  function makeId() {
    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return String(Date.now() + Math.random());
  }

  /* load saved data */
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

      if (Array.isArray(saved)) {
        notes = saved;
      }
    } catch {
      notes = [];
    }

    const savedTrashCount = Number(
      localStorage.getItem(TRASH_COUNT_KEY)
    );

    trashCount =
      Number.isFinite(savedTrashCount) &&
      savedTrashCount >= 0
        ? savedTrashCount
        : 0;

    if (
      localStorage.getItem(STORAGE_KEY) === null &&
      !notes.length
    ) {
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

      saveNotes();
    }

    updateTrashCount();
    renderAll();
  }

  /* save notes */
  function saveNotes() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(notes)
    );
  }

  /* save trash count */
  function saveTrashCount() {
    localStorage.setItem(
      TRASH_COUNT_KEY,
      String(trashCount)
    );
  }

  /* update trash counter */
  function updateTrashCount() {
    trashCountEl.textContent = String(trashCount);
  }

  /* small message popup */
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 1300);
  }

  /* empty board message */
  function updateEmptyState() {
    emptyState.style.opacity = notes.length ? "0" : "1";
  }

  /* note size */
  function noteSize() {
    if (
      window.matchMedia("(max-width: 620px)").matches
    ) {
      return {
        w: 160,
        h: 140
      };
    }

    return {
      w: 190,
      h: 160
    };
  }

  /* keep notes inside board bounds */
  function clampPosition(x, y) {
    const rect = board.getBoundingClientRect();
    const size = noteSize();

    const maxX = Math.max(
      8,
      rect.width - size.w - 8
    );

    const maxY = Math.max(
      8,
      rect.height - size.h - 8
    );

    return {
      x: Math.max(
        8,
        Math.min(x, maxX)
      ),
      y: Math.max(
        8,
        Math.min(y, maxY)
      )
    };
  }

  /* color selection */
  function setSelectedColor(color) {
    selectedColor = color;

    for (const dot of colorDots) {
      const isSelected =
        dot.dataset.color === color;

      dot.classList.toggle(
        "selected",
        isSelected
      );

      dot.setAttribute(
        "aria-pressed",
        String(isSelected)
      );
    }
  }

  /* render everything */
  function renderAll() {
    board
      .querySelectorAll(".sticky")
      .forEach((element) => {
        element.remove();
      });

    for (const note of notes) {
      renderNote(note);
    }

    updateEmptyState();
  }

  /* create sticky note */

  function renderNote(note) {
    const pos = clampPosition(
      Number(note.x) || 8,
      Number(note.y) || 8
    );

    note.x = pos.x;
    note.y = pos.y;

    const element =
      document.createElement("div");

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

    element.tabIndex = 0;

    element.setAttribute(
      "aria-label",
      `${note.text}. Press and hold to drag. Press Delete or Backspace while focused to remove.`
    );

    const text =
      document.createElement("span");

    text.className = "task-text";
    text.textContent = note.text;

    const hint =
      document.createElement("span");

    hint.className = "hint";
    hint.textContent = "hold + drag";

    const editButton =
      document.createElement("button");

    editButton.type = "button";
    editButton.className = "edit-btn";

    editButton.setAttribute(
      "aria-label",
      `Edit ${note.text}`
    );

    editButton.innerHTML = `
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path d="M12 20h9"></path>
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path>
      </svg>
    `;

    editButton.addEventListener(
      "pointerdown",
      (event) => {
        event.stopPropagation();
      }
    );

    editButton.addEventListener(
      "click",
      (event) => {
        event.stopPropagation();
        editNote(note.id);
      }
    );

    element.append(
      text,
      hint,
      editButton
    );

    board.appendChild(element);

    element.addEventListener(
      "pointerdown",
      startHold
    );

    element.addEventListener(
      "pointermove",
      movePointer
    );

    element.addEventListener(
      "pointerup",
      endPointer
    );

    element.addEventListener(
      "pointercancel",
      cancelPointer
    );

    element.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Delete" ||
          event.key === "Backspace"
        ) {
          event.preventDefault();

          deleteNote(
            note.id,
            element,
            true
          );
        }
      }
    );
  }

  /* EDIT NOTE */
  function editNote(id) {
    const note = notes.find(
      (item) => item.id === id
    );

    if (!note) {
      return;
    }

    const updated = window.prompt(
      "Edit this task:",
      note.text
    );

    if (updated === null) {
      return;
    }

    const clean = updated.trim();

    if (!clean) {
      showToast("Task cannot be empty");
      return;
    }

    note.text = clean.slice(0, 160);

    saveNotes();
    renderAll();
    showToast("Task updated");
  }

  /* start hold */
  function startHold(event) {
    if (
      event.target.closest(".edit-btn")
    ) {
      return;
    }

    if (
      event.button !== undefined &&
      event.button !== 0
    ) {
      return;
    }

    const element =
      event.currentTarget;

    const note = notes.find(
      (item) =>
        item.id === element.dataset.id
    );

    if (!note) {
      return;
    }

    const boardRect =
      board.getBoundingClientRect();

    drag = {
      id: note.id,
      element: element,
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
      timer: null
    };

    element.setPointerCapture?.(
      event.pointerId
    );

    drag.timer = setTimeout(() => {
      if (
        !drag ||
        drag.id !== note.id
      ) {
        return;
      }

      drag.active = true;
      zCounter += 1;
      note.z = zCounter;

      element.style.zIndex =
        String(zCounter);

      element.classList.add(
        "holding",
        "primed"
      );

      if (navigator.vibrate) {
        navigator.vibrate(12);
      }

      setTimeout(() => {
        element.classList.remove(
          "primed"
        );
      }, 180);
    }, HOLD_MS);
  }

  /*move note*/
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

    if (
      !drag.active &&
      distance > 10
    ) {
      clearTimeout(drag.timer);
      cancelPointer();
      return;
    }

    if (!drag.active) {
      return;
    }

    event.preventDefault();

    const boardRect =
      board.getBoundingClientRect();

    const note = notes.find(
      (item) =>
        item.id === drag.id
    );

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

    drag.element.style.left =
      next.x + "px";

    drag.element.style.top =
      next.y + "px";

    const overTrash =
      isOverTrash(drag.element);

    trashWrap.classList.toggle(
      "active",
      overTrash
    );
  }

  /* drop note*/
  function endPointer(event) {
    if (
      !drag ||
      event.pointerId !== drag.pointerId
    ) {
      return;
    }

    clearTimeout(drag.timer);

    if (drag.active) {
      const overTrash =
        isOverTrash(drag.element);

      drag.element.classList.remove(
        "holding",
        "primed"
      );

      trashWrap.classList.remove(
        "active"
      );

      if (overTrash) {
        const id = drag.id;
        const element = drag.element;

        drag = null;

        deleteNote(
          id,
          element,
          true
        );

        return;
      }

      saveNotes();
    }

    drag.element.releasePointerCapture?.(
      event.pointerId
    );

    drag = null;
  }

  /* cancel drag */
  function cancelPointer() {
    if (!drag) {
      return;
    }

    clearTimeout(drag.timer);

    drag.element.classList.remove(
      "holding",
      "primed"
    );

    trashWrap.classList.remove(
      "active"
    );

    try {
      drag.element
        .releasePointerCapture?.(
          drag.pointerId
        );
    } catch {
      /* Nothing needed here */
    }

    drag = null;
  }

  /* check trash collision */
  function isOverTrash(noteElement) {
    const noteRect =
      noteElement.getBoundingClientRect();

    const trashRect =
      trashZone.getBoundingClientRect();

    const centerX =
      noteRect.left +
      noteRect.width / 2;

    const centerY =
      noteRect.top +
      noteRect.height / 2;

    return (
      centerX >= trashRect.left - 15 &&
      centerX <= trashRect.right + 15 &&
      centerY >= trashRect.top - 15 &&
      centerY <= trashRect.bottom + 15
    );
  }

  /*delete note */
  function deleteNote(
    id,
    element,
    countAsTrash
  ) {
    const index = notes.findIndex(
      (note) => note.id === id
    );

    if (index === -1) {
      return;
    }

    notes.splice(index, 1);

    saveNotes();

    if (countAsTrash) {
      trashCount += 1;

      saveTrashCount();
      updateTrashCount();
    }

    element.classList.add(
      "deleting"
    );

    showToast(
      "Task thrown away"
    );

    setTimeout(() => {
      element.remove();
      updateEmptyState();
    }, 330);
  }

  /* add new note */
  function addNote(text) {
    const clean = text.trim();

    if (!clean) {
      input.focus();
      return;
    }

    const rect =
      board.getBoundingClientRect();

    const size =
      noteSize();

    const randomRange = Math.max(
      40,
      rect.width -
        size.w -
        170
    );

    const x = Math.max(
      110,
      Math.min(
        rect.width -
          size.w -
          20,
        70 +
          Math.random() *
          randomRange
      )
    );

    const maxY = Math.max(
      60,
      rect.height -
        size.h -
        30
    );

    zCounter += 1;

    const note = {
      id: makeId(),
      text: clean.slice(0, 160),
      x: x,
      y: Math.max(
        25,
        Math.min(
          maxY,
          35 +
            Math.random() *
            Math.max(
              30,
              maxY - 35
            )
        )
      ),
      rotation:
        Math.round(
          (
            Math.random() * 5 -
            2.5
          ) * 10
        ) / 10,
      color: selectedColor,
      z: zCounter
    };

    notes.push(note);

    saveNotes();
    renderNote(note);
    updateEmptyState();

    showToast(
      "Sticky note added"
    );
  }

  /* color button events */
  for (const dot of colorDots) {
    dot.addEventListener(
      "click",
      () => {
        setSelectedColor(
          dot.dataset.color
        );
      }
    );
  }

  /* add note button */
  form.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();

      addNote(input.value);

      input.value = "";
      input.focus();
    }
  );

  /* window resize */
  window.addEventListener(
    "resize",
    () => {
      for (const note of notes) {
        const pos = clampPosition(
          note.x,
          note.y
        );

        note.x = pos.x;
        note.y = pos.y;

        const element =
          board.querySelector(
            `.sticky[data-id="${CSS.escape(note.id)}"]`
          );

        if (element) {
          element.style.left =
            note.x + "px";

          element.style.top =
            note.y + "px";
        }
      }

      saveNotes();
    }
  );

  /* start app */
  setSelectedColor("1");
  load();
})();