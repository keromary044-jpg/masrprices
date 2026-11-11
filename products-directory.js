"use strict";
const search = document.getElementById("q");
if (search) {
  search.addEventListener("input", () => {
    const term = search.value.trim().toLocaleLowerCase("ar");
    let count = 0;
    document.querySelectorAll(".group").forEach(group => {
      let visible = 0;
      group.querySelectorAll("li").forEach(item => {
        const show = item.textContent.toLocaleLowerCase("ar").includes(term);
        item.hidden = !show;
        if (show) visible++;
      });
      group.hidden = visible === 0;
      count += visible;
    });
    const empty = document.getElementById("empty");
    if (empty) empty.style.display = count ? "none" : "block";
  });
}
