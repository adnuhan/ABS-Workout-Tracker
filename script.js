// ---------- STORAGE ----------
const STORAGE_KEY = "absTrackerData";
let appData = {};
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let weeklyChartInstance = null;
let viewMode = "month"; // 'month' or 'year'
// Streak tracking (computed across all stored months)
let currentStreak = 0;
let longestStreak = 0;

function getMonthKey(year, month) {
  return `${year}-${month}`;
}

function loadData() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    appData = JSON.parse(stored);
  } else {
    appData = {};
  }
  const key = getMonthKey(currentYear, currentMonth);
  if (!appData[key]) {
    appData[key] = {};
  }
  saveToLocal();
}

function saveToLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstWeekday(year, month) {
  return new Date(year, month, 1).getDay();
}

// FIXED STREAK LOGIC: Calculates the CURRENT consecutive streak ending on TODAY or the most recent completed day
// It checks backwards from the most recent date (today or last completed day) until a gap is found
// streak/longest-streak computation removed (display removed per user request)

// Get consecutive streak within current month for glow effect
function getConsecutiveRangesInMonth(monthData, daysInMonth) {
  let ranges = [];
  let temp = [];
  for (let d = 1; d <= daysInMonth; d++) {
    if (monthData[d] === true) {
      temp.push(d);
    } else {
      if (temp.length > 0) ranges.push([...temp]);
      temp = [];
    }
  }
  if (temp.length > 0) ranges.push(temp);
  return ranges;
}

function buildCompletedDateSet() {
  const set = new Set();
  for (const key in appData) {
    const [yStr, mStr] = key.split("-");
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const monthData = appData[key] || {};
    for (const dStr in monthData) {
      if (monthData[dStr] === true) {
        const day = parseInt(dStr, 10);
        const dt = new Date(y, m, day);
        const iso = dt.toISOString().slice(0, 10);
        set.add(iso);
      }
    }
  }
  return set;
}

function computeCurrentStreak() {
  const completed = buildCompletedDateSet();
  const today = new Date();
  function toISO(d) {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  }
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let found = null;
  for (let i = 0; i < 3650; i++) {
    const iso = toISO(cursor);
    if (completed.has(iso)) {
      found = new Date(cursor);
      break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  if (!found) return 0;
  let count = 0;
  cursor = new Date(found);
  while (true) {
    const iso = toISO(cursor);
    if (completed.has(iso)) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return count;
}

function computeLongestStreak() {
  const completed = Array.from(buildCompletedDateSet()).sort();
  if (completed.length === 0) return 0;
  function fromISO(s) {
    const [yy, mm, dd] = s.split("-").map((x) => parseInt(x, 10));
    return new Date(yy, mm - 1, dd);
  }
  let longest = 0;
  let current = 1;
  for (let i = 1; i < completed.length; i++) {
    const prev = fromISO(completed[i - 1]);
    const cur = fromISO(completed[i]);
    const diff = Math.round((cur - prev) / (24 * 3600 * 1000));
    if (diff === 1) {
      current++;
    } else if (diff === 0) {
      // duplicate day — ignore
    } else {
      if (current > longest) longest = current;
      current = 1;
    }
  }
  if (current > longest) longest = current;
  return longest;
}

function updateStreaks() {
  currentStreak = computeCurrentStreak();
  longestStreak = computeLongestStreak();
  window.getCurrentStreak = () => currentStreak;
  window.getLongestStreak = () => longestStreak;
  console.debug("Streaks updated:", { currentStreak, longestStreak });
  return { currentStreak, longestStreak };
}

function showMotivationPopup(msg) {
  let popup = document.createElement("div");
  popup.className = "motivation-popup";
  popup.innerText = msg + " 💪✨";
  document.body.appendChild(popup);
  setTimeout(() => {
    popup.remove();
  }, 3000);
}

// milestone celebration removed (streak display removed)
function toggleDay(dayNumber) {
  const key = getMonthKey(currentYear, currentMonth);
  if (!appData[key]) appData[key] = {};
  const isCompleted = appData[key][dayNumber] === true;
  const newStatus = !isCompleted;
  appData[key][dayNumber] = newStatus;
  saveToLocal();

  // Update streak computations after changing a day
  updateStreaks();

  renderCalendar();
  updateProgressBarAndStats();
  updateWeeklyChart();
}

function renderCalendar() {
  const calendarDiv = document.getElementById("calendarGrid");
  // Ensure weekdays header is visible in month view
  const weekdaysRow = document.querySelector(".weekdays");
  if (weekdaysRow) weekdaysRow.style.display = "grid";
  // ensure grid class for month view
  calendarDiv.classList.remove("year-view");
  calendarDiv.classList.add("calendar-grid");

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstWeekday = getFirstWeekday(currentYear, currentMonth);
  calendarDiv.innerHTML = "";
  const monthKey = getMonthKey(currentYear, currentMonth);
  if (!appData[monthKey]) appData[monthKey] = {};
  const monthData = appData[monthKey];

  const streakRanges = getConsecutiveRangesInMonth(monthData, daysInMonth);

  function isInConsecutiveStreak(day) {
    for (let block of streakRanges) {
      if (block.length >= 2 && block.includes(day)) return true;
    }
    return false;
  }

  function shouldShowTrophy(day, isComp) {
    if (!isComp) return false;
    const milestones = [5, 10, 15, 20, 25, 30];
    if (!milestones.includes(day)) return false;
    for (let block of streakRanges) {
      if (block.includes(day) && block.length >= day) {
        return true;
      }
    }
    return false;
  }

  for (let i = 0; i < daysInMonth; i++) {
    const dayNumber = i + 1;
    const isCompleted = monthData[dayNumber] === true;
    const cell = document.createElement("div");
    cell.className = "day-cell";
    if (isCompleted) cell.classList.add("completed");
    if (isCompleted && isInConsecutiveStreak(dayNumber)) {
      cell.classList.add("streak-glow");
    }
    cell.innerText = dayNumber;
    if (shouldShowTrophy(dayNumber, isCompleted)) {
      const trophySpan = document.createElement("span");
      trophySpan.className = "milestone-badge";
      trophySpan.innerText = "🏆";
      cell.style.position = "relative";
      cell.appendChild(trophySpan);
    }

    // Determine whether this day is in the past (strictly before today).
    const today = new Date();
    const todayY = today.getFullYear();
    const todayM = today.getMonth();
    const todayD = today.getDate();

    let isPast = false;
    if (currentYear < todayY) isPast = true;
    else if (currentYear === todayY && currentMonth < todayM) isPast = true;
    else if (
      currentYear === todayY &&
      currentMonth === todayM &&
      dayNumber < todayD
    )
      isPast = true;

    if (isPast) {
      // Mark visually and prevent interaction for past days
      cell.classList.add("past-day");
      cell.setAttribute("aria-disabled", "true");
      cell.title = "This day is in the past and locked.";
    } else {
      // Only attach click handler for today or future days
      cell.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleDay(dayNumber);
      });
      cell.title = "Click to toggle completion";
    }

    calendarDiv.appendChild(cell);
  }

  // Add empty cells for days before month start
  for (let i = 0; i < firstWeekday; i++) {
    let emptyCell = document.createElement("div");
    emptyCell.style.background = "transparent";
    emptyCell.style.cursor = "default";
    emptyCell.style.aspectRatio = "1/1";
    emptyCell.style.borderRadius = "1rem";
    calendarDiv.prepend(emptyCell);
  }
}

// Render a Year view: 12 month-cards showing completion percent for the selected year
function renderYearView() {
  const calendarDiv = document.getElementById("calendarGrid");
  // Hide weekday labels when showing year view
  const weekdaysRow = document.querySelector(".weekdays");
  if (weekdaysRow) weekdaysRow.style.display = "none";
  calendarDiv.innerHTML = "";
  calendarDiv.classList.remove("calendar-grid");
  calendarDiv.classList.add("year-view");

  for (let m = 0; m < 12; m++) {
    const monthName = new Date(currentYear, m, 1).toLocaleString("default", {
      month: "short",
    });

    const daysInMonth = getDaysInMonth(currentYear, m);
    const key = getMonthKey(currentYear, m);
    let completed = 0;
    if (appData[key]) {
      for (let d = 1; d <= daysInMonth; d++)
        if (appData[key][d] === true) completed++;
    }
    const percent =
      daysInMonth > 0 ? Math.round((completed / daysInMonth) * 100) : 0;

    const card = document.createElement("div");
    card.className = "month-card";
    card.title = `${monthName} ${currentYear}: ${completed}/${daysInMonth} days completed`;

    const nameEl = document.createElement("div");
    nameEl.className = "month-name";
    nameEl.innerText = monthName;

    const pctEl = document.createElement("div");
    pctEl.className = "month-pct";
    pctEl.innerText = `${percent}%`;

    const miniBg = document.createElement("div");
    miniBg.className = "mini-progress-bg";
    const miniFill = document.createElement("div");
    miniFill.className = "mini-progress-fill";
    miniFill.style.width = `${percent}%`;
    miniBg.appendChild(miniFill);

    card.appendChild(nameEl);
    card.appendChild(pctEl);
    card.appendChild(miniBg);

    // click a month to switch to month view focused on that month
    card.addEventListener("click", () => {
      viewMode = "month";
      currentMonth = m;
      // update selects
      const monthSelect = document.getElementById("monthSelect");
      if (monthSelect) monthSelect.value = currentMonth;
      // ensure calendar-grid class set back
      calendarDiv.classList.remove("year-view");
      calendarDiv.classList.add("calendar-grid");
      refreshAll();
      // toggle active buttons
      document.getElementById("monthViewBtn")?.classList.add("active");
      document.getElementById("yearViewBtn")?.classList.remove("active");
    });

    calendarDiv.appendChild(card);
  }
}

function updateProgressBarAndStats() {
  const monthKey = getMonthKey(currentYear, currentMonth);
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  let completedCount = 0;
  if (appData[monthKey]) {
    for (let d = 1; d <= daysInMonth; d++) {
      if (appData[monthKey][d] === true) completedCount++;
    }
  }
  let percent = (completedCount / daysInMonth) * 100;
  const percentSpan = document.getElementById("progressPercent");
  percentSpan.innerText = `${Math.round(percent)}%`;

  // Update stats
  document.getElementById("monthlyCompletedCount").innerText = completedCount;
  document.getElementById("monthlyTotalDays").innerText = daysInMonth;
  document.getElementById("monthlyCompletionRate").innerText =
    `${Math.round(percent)}%`;
}

// donut and its animator removed per user request

function updateWeeklyChart() {
  // Build weekly completion counts and render bar chart
  const monthKey = getMonthKey(currentYear, currentMonth);
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDate = new Date(currentYear, currentMonth, 1);
  const firstWeekdayOfMonth = firstDate.getDay();

  const weeks = [];
  let day = 1;
  while (day <= daysInMonth) {
    const index = Math.floor((firstWeekdayOfMonth + day - 1) / 7);
    if (!weeks[index]) weeks[index] = new Array(7).fill(null);
    const weekday = (firstWeekdayOfMonth + day - 1) % 7;
    weeks[index][weekday] = day;
    day++;
  }

  const weekCounts = weeks.map((w) =>
    w.reduce(
      (sum, d) => (d && appData[monthKey]?.[d] === true ? sum + 1 : sum),
      0,
    ),
  );

  const labels = weekCounts.map((_, i) => `Wk ${i + 1}`);
  const dataVals = weekCounts;

  const canvas = document.getElementById("weeklyChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const cssColor =
    getComputedStyle(document.documentElement).getPropertyValue(
      "--day-completed",
    ) || "#22c55e";
  const bgColor = cssColor.trim();

  if (weeklyChartInstance) weeklyChartInstance.destroy();
  weeklyChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "✅ Completed Days",
          data: dataVals,
          backgroundColor: bgColor,
          borderRadius: 8,
          barPercentage: 0.65,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: getComputedStyle(document.documentElement).getPropertyValue(
              "--text-secondary",
            ),
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            color: getComputedStyle(document.documentElement).getPropertyValue(
              "--text-secondary",
            ),
          },
          grid: {
            color: getComputedStyle(document.documentElement).getPropertyValue(
              "--chart-grid",
            ),
          },
        },
      },
    },
  });
}

function exportCSV() {
  const monthKey = getMonthKey(currentYear, currentMonth);
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  let rows = [["Day Number", "Completed (Yes/No)"]];
  for (let d = 1; d <= daysInMonth; d++) {
    let status = appData[monthKey]?.[d] === true ? "Yes" : "No";
    rows.push([d, status]);
  }
  let csvContent = rows.map((row) => row.join(",")).join("\n");
  let blob = new Blob([csvContent], { type: "text/csv" });
  let link = document.createElement("a");
  let url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `abs_tracker_${currentYear}_${currentMonth + 1}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showMotivationPopup("📁 CSV exported! Track your progress.");
}
// CSV export removed per user request.

// Clear all app data after asking for confirmation.
function resetAllData() {
  const ok = confirm(
    "Are you sure you want to reset all progress? This will clear all tracked days across all months.",
  );
  if (!ok) return;

  // Clear in-memory and localStorage
  appData = {};
  saveToLocal();

  // Ensure current month key exists so UI doesn't break
  const key = getMonthKey(currentYear, currentMonth);
  if (!appData[key]) appData[key] = {};

  refreshAll();
  showMotivationPopup("All progress cleared. Start fresh! 🧹");
}

// Expose the reset function so it can be invoked from the browser console
// Usage: open DevTools Console and run `window.resetAllData()`
// Note: this is irreversible and clears all months' data from localStorage.
window.resetAllData = resetAllData;

function populateMonthYear() {
  const monthSelect = document.getElementById("monthSelect");
  const yearSelect = document.getElementById("yearSelect");
  monthSelect.innerHTML = "";
  yearSelect.innerHTML = "";

  for (let m = 0; m < 12; m++) {
    let option = document.createElement("option");
    option.value = m;
    option.innerText = new Date(2000, m, 1).toLocaleString("default", {
      month: "long",
    });
    monthSelect.appendChild(option);
  }

  const startYear = 2020;
  const endYear = 2032;
  for (let y = startYear; y <= endYear; y++) {
    let opt = document.createElement("option");
    opt.value = y;
    opt.innerText = y;
    yearSelect.appendChild(opt);
  }

  monthSelect.value = currentMonth;
  yearSelect.value = currentYear;

  monthSelect.addEventListener("change", (e) => {
    currentMonth = parseInt(e.target.value);
    const key = getMonthKey(currentYear, currentMonth);
    if (!appData[key]) appData[key] = {};
    saveToLocal();
    refreshAll();
  });

  yearSelect.addEventListener("change", (e) => {
    currentYear = parseInt(e.target.value);
    const key = getMonthKey(currentYear, currentMonth);
    if (!appData[key]) appData[key] = {};
    saveToLocal();
    refreshAll();
  });
}

function refreshAll() {
  if (viewMode === "month") renderCalendar();
  else renderYearView();
  updateProgressBarAndStats();
  updateWeeklyChart();
}

function initTheme() {
  // Use checkbox toggle (#mode-toggle) instead of a separate button
  const modeToggle = document.getElementById("mode-toggle");
  const savedDark = localStorage.getItem("theme") === "dark";
  if (savedDark) document.body.classList.add("dark");
  if (modeToggle) {
    modeToggle.checked = savedDark;
    modeToggle.addEventListener("change", () => {
      const isDark = modeToggle.checked;
      document.body.classList.toggle("dark", isDark);
      localStorage.setItem("theme", isDark ? "dark" : "light");
      updateWeeklyChart();
    });
  }
}

function init() {
  loadData();
  populateMonthYear();
  initTheme();
  refreshAll();
  // View toggle buttons (Month / Year)
  const monthViewBtn = document.getElementById("monthViewBtn");
  const yearViewBtn = document.getElementById("yearViewBtn");
  if (monthViewBtn && yearViewBtn) {
    monthViewBtn.addEventListener("click", () => {
      viewMode = "month";
      monthViewBtn.classList.add("active");
      yearViewBtn.classList.remove("active");
      refreshAll();
    });
    yearViewBtn.addEventListener("click", () => {
      viewMode = "year";
      yearViewBtn.classList.add("active");
      monthViewBtn.classList.remove("active");
      refreshAll();
    });
  }
}

init();
