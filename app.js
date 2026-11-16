//Data
const KEY = "dailynotes.v1";
const $ = (id) => document.getElementById(id);

let data = load();
let viewDate = todayStr();
let reportRange = 7;

function load() {
    try {
        const d = JSON.parse(localStorage.getItem(KEY));
        if (d && Array.isArray(d.tasks) && Array.isArray(d.habits)) {
            d.log = d.log || {};
            d.sent = d.sent || {};
            return d;
        }
    } catch (e) { }

    const fresh = { tasks: [], habits: [], log: {}, sent: {} };
    // bring over tasks saved by the first version of the app
    try {
        const old = JSON.parse(localStorage.getItem("tasks"));
        if (Array.isArray(old)) {
            old.forEach((t) =>
                fresh.tasks.push({ id: String(t.id), text: t.text, done: !!t.done, date: todayStr(), time: "" })
            );
        }
    } catch (e) { }
    return fresh;
}

function save() {
    localStorage.setItem(KEY, JSON.stringify(data));
}

//Dates (always local time, as YYYY-MM-DD)
function pad(n) { return String(n).padStart(2, "0"); }
function toStr(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function todayStr() { return toStr(new Date()); }
function parse(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function shift(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return toStr(d); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

//Small helper to build elements
function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const k in attrs) {
        if (k === "class") e.className = attrs[k];
        else if (k.startsWith("on")) e.addEventListener(k.slice(2), attrs[k]);
        else e[k] = attrs[k];
    }
    e.append(...kids);
    return e;
}

//Habits
function isDone(habit, date) {
    return !!(data.log[date] && data.log[date][habit.id]);
}

function setHabit(habit, date, checked) {
    data.log[date] = data.log[date] || {};
    if (checked) data.log[date][habit.id] = true;
    else delete data.log[date][habit.id];
    save();
    render();
}

function streak(habit) {
    let d = todayStr();
    if (!isDone(habit, d)) d = shift(d, -1); // today not done yet: don't break the streak
    let n = 0;
    while (d >= habit.start && isDone(habit, d)) {
        n++;
        d = shift(d, -1);
    }
    return n;
}

//Progress
function dayStats(date) {
    const tasks = data.tasks.filter((t) => t.date === date);
    const habits = data.habits.filter((h) => h.start <= date);
    const done = tasks.filter((t) => t.done).length + habits.filter((h) => isDone(h, date)).length;
    return { done, total: tasks.length + habits.length };
}

//Rendering
function render() {
    renderHeader();
    renderTasks();
    renderHabits();
    renderReport();
}

function renderHeader() {
    const today = todayStr();
    let label = parse(viewDate).toLocaleDateString(undefined, { weekday: "long" });
    if (viewDate === today) label = "Today";
    else if (viewDate === shift(today, -1)) label = "Yesterday";
    else if (viewDate === shift(today, 1)) label = "Tomorrow";

    $("day-label").textContent = label;
    $("day-date").textContent = parse(viewDate).toLocaleDateString(undefined, {
        day: "numeric", month: "long", year: "numeric",
    });
    $("today-btn").hidden = viewDate === today;

    const { done, total } = dayStats(viewDate);
    const pct = total ? Math.round((done / total) * 100) : 0;
    $("bar").style.width = pct + "%";
    $("progress-text").textContent = total
        ? (done === total ? "All done for this day!" : `${done} of ${total} done (${pct}%)`)
        : "Nothing planned yet";
}

function renderTasks() {
    const list = $("task-list");
    list.innerHTML = "";
    const tasks = data.tasks.filter((t) => t.date === viewDate);

    if (!tasks.length) list.append(el("p", { class: "empty", textContent: "No tasks yet. Add one above." }));

    tasks.forEach((t) => {
        const li = el("li", { class: t.done ? "done" : "" },
            el("input", {
                type: "checkbox", checked: t.done,
                onchange: (e) => { t.done = e.target.checked; save(); render(); },
            }),
            el("span", { class: "label", textContent: t.text }),
            t.time ? el("span", { class: "badge", textContent: t.time }) : "",
            el("button", {
                class: "del", title: "Delete task", textContent: "\u00d7",
                onclick: () => { data.tasks = data.tasks.filter((x) => x.id !== t.id); save(); render(); },
            })
        );
        list.append(li);
    });

    // offer to move unfinished tasks from the day before
    const left = data.tasks.filter((t) => t.date === shift(viewDate, -1) && !t.done);
    const btn = $("carry-btn");
    btn.hidden = left.length === 0;
    if (left.length) btn.textContent = `Move ${left.length} unfinished task${left.length > 1 ? "s" : ""} from the day before`;
}

function renderHabits() {
    const list = $("habit-list");
    list.innerHTML = "";
    const habits = data.habits.filter((h) => h.start <= viewDate);

    if (!habits.length) list.append(el("p", { class: "empty", textContent: "Add things you do every day, like drinking water or reading." }));

    habits.forEach((h) => {
        const done = isDone(h, viewDate);
        const s = streak(h);
        const li = el("li", { class: done ? "done" : "" },
            el("input", { type: "checkbox", checked: done, onchange: (e) => setHabit(h, viewDate, e.target.checked) }),
            el("span", { class: "label", textContent: h.name }),
            h.time ? el("span", { class: "badge", textContent: h.time }) : "",
            s > 1 ? el("span", { class: "badge", textContent: s + " day streak" }) : "",
            el("button", {
                class: "del", title: "Delete habit", textContent: "\u00d7",
                onclick: () => {
                    if (confirm(`Delete "${h.name}" and its history?`)) {
                        data.habits = data.habits.filter((x) => x.id !== h.id);
                        save(); render();
                    }
                },
            })
        );
        list.append(li);
    });
}

function reportRow(label, done, total, extra) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    const fill = el("div");
    fill.style.width = pct + "%";
    return el("div", { class: "row" },
        el("div", { class: "row-top" },
            el("span", { textContent: label }),
            el("span", { textContent: `${done}/${total} \u00b7 ${pct}%${extra || ""}` })
        ),
        el("div", { class: "meter" }, fill)
    );
}

function renderReport() {
    const box = $("report");
    box.innerHTML = "";
    const today = todayStr();
    const days = [];
    for (let i = reportRange - 1; i >= 0; i--) days.push(shift(today, -i));

    // one bar per day: how much of that day got done
    const chart = el("div", { class: "chart" });
    days.forEach((d) => {
        const s = dayStats(d);
        const bar = el("div", { class: "bar" });
        bar.style.height = (s.total ? (s.done / s.total) * 100 : 0) + "%";
        const letter = reportRange === 7
            ? parse(d).toLocaleDateString(undefined, { weekday: "narrow" })
            : "";
        chart.append(el("div", { class: "col", title: `${d}: ${s.done}/${s.total}` },
            el("div", { class: "barwrap" }, bar),
            el("small", { textContent: letter })
        ));
    });
    box.append(chart);

    const tasks = data.tasks.filter((t) => days.includes(t.date));
    box.append(reportRow("All tasks", tasks.filter((t) => t.done).length, tasks.length));

    data.habits.forEach((h) => {
        const active = days.filter((d) => h.start <= d);
        const done = active.filter((d) => isDone(h, d)).length;
        const s = streak(h);
        box.append(reportRow(h.name, done, active.length, s > 0 ? ` \u00b7 streak ${s}` : ""));
    });
}

//Reminders
let toastTimer;
function showToast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 6000);
}

function toMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }

function notify(text) {
    showToast("Reminder: " + text);
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const opts = { body: text, icon: "icon-192.png", tag: text };
    const fallback = () => { try { new Notification("Daily Notes", opts); } catch (e) { } };
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistration()
            .then((r) => (r ? r.showNotification("Daily Notes", opts) : fallback()))
            .catch(fallback);
    } else fallback();
}

function checkReminders() {
    const today = todayStr();
    const n = new Date();
    const now = n.getHours() * 60 + n.getMinutes();

    Object.keys(data.sent).forEach((k) => { if (!k.startsWith(today)) delete data.sent[k]; });

    const items = [];
    data.tasks.forEach((t) => {
        if (t.date === today && t.time && !t.done) items.push({ key: today + ":" + t.id, text: t.text, time: t.time });
    });
    data.habits.forEach((h) => {
        if (h.time && h.start <= today && !isDone(h, today)) items.push({ key: today + ":" + h.id, text: h.name, time: h.time });
    });

    items.forEach((i) => {
        const diff = now - toMin(i.time);
        // fire once, at the time or up to 30 minutes late (e.g. phone was asleep)
        if (diff >= 0 && diff <= 30 && !data.sent[i.key]) {
            data.sent[i.key] = true;
            save();
            notify(i.text);
        }
    });
}

function updateNotifyBtn() {
    const b = $("notify-btn");
    if (!("Notification" in window)) { b.hidden = true; return; }
    if (Notification.permission === "granted") { b.textContent = "Reminders are on"; b.disabled = true; }
}

//Event handlers
$("prev").addEventListener("click", () => { viewDate = shift(viewDate, -1); render(); });
$("next").addEventListener("click", () => { viewDate = shift(viewDate, 1); render(); });
$("today-btn").addEventListener("click", () => { viewDate = todayStr(); render(); });

$("task-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $("task-input").value.trim();
    if (!text) return;
    data.tasks.push({ id: uid(), text, done: false, date: viewDate, time: $("task-time").value });
    $("task-input").value = "";
    $("task-time").value = "";
    save();
    render();
    checkReminders();
});

$("habit-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("habit-input").value.trim();
    if (!name) return;
    data.habits.push({ id: uid(), name, time: $("habit-time").value, start: todayStr() });
    $("habit-input").value = "";
    $("habit-time").value = "";
    save();
    render();
});

$("carry-btn").addEventListener("click", () => {
    data.tasks.forEach((t) => {
        if (t.date === shift(viewDate, -1) && !t.done) t.date = viewDate;
    });
    save();
    render();
});

document.querySelectorAll(".tabs button").forEach((b) => {
    b.addEventListener("click", () => {
        reportRange = Number(b.dataset.range);
        document.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("active", x === b));
        renderReport();
    });
});

$("notify-btn").addEventListener("click", async () => {
    if (!("Notification" in window)) return showToast("This browser does not support notifications.");
    const p = await Notification.requestPermission();
    showToast(p === "granted"
        ? "Reminders are on. They show while the app is open or running in the background."
        : "Reminders are blocked. Allow notifications for this site in your browser settings.");
    updateNotifyBtn();
});

$("export-btn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = el("a", { href: URL.createObjectURL(blob), download: `daily-notes-${todayStr()}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$("import-btn").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const d = JSON.parse(reader.result);
            if (!Array.isArray(d.tasks) || !Array.isArray(d.habits)) throw new Error("bad file");
            if (!confirm("Replace everything in this app with the backup?")) return;
            d.log = d.log || {};
            d.sent = d.sent || {};
            data = d;
            save();
            render();
            showToast("Backup restored.");
        } catch (err) {
            showToast("That file is not a Daily Notes backup.");
        }
    };
    reader.readAsText(file);
});

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { render(); checkReminders(); }
});

//Start
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => { });
}
updateNotifyBtn();
render();
checkReminders();
setInterval(checkReminders, 20000);