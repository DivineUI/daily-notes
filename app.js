let tasks = JSON.parse(localStorage.getItem("tasks")) || [];

function saveTasks() {
    localStorage.setItem("tasks", JSON.stringify(tasks));
}
const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const list = document.getElementById("task-list");

function render() {
    list.innerHTML = "";
    tasks.forEach(function (task) {
        const li = document.createElement("li");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = task.done;
        checkbox.addEventListener("change", function () {
            task.done = checkbox.checked;
            saveTasks();
            render();
        });

        const text = document.createElement("span");
        text.textContent = task.text;
        if (task.done) text.style.textDecoration = "line-through";

        li.append(checkbox, text);
        list.appendChild(li);
    });
}
form.addEventListener("submit", function (event) {
    event.preventDefault();
    tasks.push({ id: Date.now(), text: input.value.trim(), done: false });
    input.value = "";
    saveTasks();
    render();
});

render();