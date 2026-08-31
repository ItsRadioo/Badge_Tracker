const STORAGE_KEY = "scoutGroupBadgeTrackerV2";
const LEGACY_KEY = "beaverBadgeTrackerV1";
const MAX_ROSTER = 25;

const oasStreams = [
  "Aquatic Skills", "Camping Skills", "Emergency Aid Skills", "Hiking Skills",
  "Paddling Skills", "Sailing Skills", "Scoutcraft Skills", "Trail Skills",
  "Vertical Skills", "Winter Skills"
];

const sectionConfigs = {
  beavers: {
    label: "Beavers",
    youthLabel: "Beaver Scout",
    rosterLabel: "Beaver roster",
    unitLabel: "Colony",
    defaultUnit: "",
    progressions: [["brown", "Brown Tail"], ["blue", "Blue Tail"], ["white", "White Tail"]],
    topAward: ["northstar", "North Star Award"],
    linkAward: ["link", "Link Badge"],
    badges: [
      ["EXP", "Exploring Beaver"], ["EAR", "Earth Beaver"], ["LEA", "Leader Beaver"],
      ["HER", "Beaver Heroes"], ["OLY", "Olympic Beaver"], ["CHE", "Chef Beaver"],
      ["PET", "Pet Care Beaver"], ["TEC", "Tech Beaver"], ["COM", "Community Beaver"],
      ["CAN", "Canada Beaver"], ["WRL", "Beavers of the World"], ["MUS", "Musical Beaver"],
      ["SCI", "Scientific Beaver"], ["CRE", "Creative Beaver"], ["SPI", "Spirit Beaver"],
      ["FRI", "Friendship Beaver"]
    ]
  },
  cubs: {
    label: "Cubs",
    youthLabel: "Cub Scout",
    rosterLabel: "Cub roster",
    unitLabel: "Pack",
    defaultUnit: "",
    progressions: [["runner", "Runner"], ["tracker", "Tracker"], ["howler", "Howler"]],
    topAward: ["seeonee", "Seeonee Award"],
    linkAward: ["link", "Link Badge"],
    badges: [
      ["ART", "Arts"], ["BLD", "Building"], ["CAN", "Canada"], ["COM", "Community"],
      ["EAR", "Earth"], ["HOB", "Hobby"], ["HOM", "Home"], ["PET", "Pet Care"],
      ["SCI", "Scientist"], ["SPA", "Space"], ["SUM", "Summer Fitness"], ["TEC", "Technology"],
      ["WAT", "Water"], ["WIN", "Winter Fitness"], ["WRL", "World"], ["YRF", "Year-round Fitness"]
    ]
  },
  scouts: {
    label: "Scouts",
    youthLabel: "Scout",
    rosterLabel: "Scout roster",
    unitLabel: "Troop",
    defaultUnit: "",
    progressions: [["voyageur", "Voyageur"], ["pathfinder", "Pathfinder"], ["trailblazer", "Trailblazer"], ["pioneer", "Pioneer"]],
    topAward: ["chiefscout", "Chief Scout's Award"],
    linkAward: ["link", "Link Badge"],
    badges: [
      ["ART", "Arts"], ["CAN", "Canada"], ["COM", "Community"], ["EAR", "Earth"],
      ["ENG", "Engineer"], ["HOB", "Hobby"], ["HOM", "Home"], ["PET", "Pet Care"],
      ["SCI", "Scientist"], ["SPA", "Space"], ["SUM", "Summer Fitness"], ["TEC", "Technology"],
      ["WAT", "Water"], ["WIN", "Winter Fitness"], ["WRL", "World"], ["YRF", "Year-round Fitness"]
    ]
  }
};

function slugify(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

function buildBadgeCatalog() {
  const items = [];
  for (const [sectionKey, config] of Object.entries(sectionConfigs)) {
    config.progressions.forEach(([key, name]) => items.push({ id: `${sectionKey}:progression:${key}`, name, category: `${config.label} progression`, section: sectionKey }));
    items.push({ id: `${sectionKey}:award:${config.topAward[0]}`, name: config.topAward[1], category: `${config.label} award`, section: sectionKey });
    items.push({ id: `${sectionKey}:award:${config.linkAward[0]}`, name: config.linkAward[1], category: `${config.label} award`, section: sectionKey });
    config.badges.forEach(([abbr, name]) => items.push({ id: `${sectionKey}:pab:${abbr}`, name, category: `${config.label} PAB`, section: sectionKey, abbr }));
  }
  for (const [sectionKey, config] of Object.entries(sectionConfigs)) {
    oasStreams.forEach(stream => {
      for (let stage = 1; stage <= 9; stage++) {
        items.push({
          id: `${sectionKey}:oas:${slugify(stream)}:${stage}`,
          name: `${stream} Stage ${stage}`,
          category: `${config.label} OAS`,
          section: sectionKey
        });
      }
    });
  }
  return items;
}

const badgeCatalog = buildBadgeCatalog();
const badgeById = Object.fromEntries(badgeCatalog.map(item => [item.id, item]));

function newInventoryState() {
  return { items: {}, issued: {}, transactions: [] };
}

function normalizeInventory(raw) {
  const inventory = newInventoryState();
  if (raw?.items && typeof raw.items === "object") {
    for (const [id, item] of Object.entries(raw.items)) {
      inventory.items[id] = {
        onHand: Math.max(0, Number(item?.onHand) || 0),
        reorderLevel: Math.max(0, Number(item?.reorderLevel) || 0)
      };
    }
  }
  inventory.issued = raw?.issued && typeof raw.issued === "object" ? { ...raw.issued } : {};
  for (const [completionId, issue] of Object.entries(inventory.issued)) {
    if (issue?.badgeId?.startsWith("oas:")) {
      const sectionKey = completionId.split("|")[0];
      if (sectionConfigs[sectionKey]) issue.badgeId = `${sectionKey}:${issue.badgeId}`;
    }
  }
  inventory.transactions = Array.isArray(raw?.transactions) ? raw.transactions.slice(-500) : [];
  return inventory;
}

function newRoster(count = 12) {
  return Array.from({ length: count }, () => ({ id: crypto.randomUUID(), name: "", prepaidDues: 0 }));
}

function newSectionState(config) {
  return {
    details: { sectionName: config.defaultUnit, scouterName: "", attendanceMonth: "" },
    roster: newRoster(),
    checks: {}
  };
}

const defaultState = {
  activeSection: "beavers",
  shared: { groupName: "1st Sault Ste. Marie", scoutingYear: "" },
  sections: Object.fromEntries(Object.entries(sectionConfigs).map(([key, config]) => [key, newSectionState(config)])),
  inventory: newInventoryState()
};

let state = loadState();
let saveTimer;

const els = {
  groupName: document.getElementById("groupName"),
  scoutingYear: document.getElementById("scoutingYear"),
  sectionName: document.getElementById("sectionName"),
  attendanceMonth: document.getElementById("attendanceMonth"),
  scouterName: document.getElementById("scouterName"),
  sectionNameLabel: document.getElementById("sectionNameLabel"),
  sectionHeading: document.getElementById("sectionHeading"),
  rosterHeading: document.getElementById("rosterHeading"),
  addPersonBtn: document.getElementById("addPersonBtn"),
  rosterEditor: document.getElementById("rosterEditor"),
  printBook: document.getElementById("printBook"),
  rowTemplate: document.getElementById("rosterRowTemplate"),
  saveStatus: document.getElementById("saveStatus")
};

function cloneDefaults() {
  return {
    activeSection: "beavers",
    shared: { ...defaultState.shared },
    sections: Object.fromEntries(Object.entries(sectionConfigs).map(([key, config]) => [key, newSectionState(config)])),
    inventory: newInventoryState()
  };
}

function normalizeSection(raw, config) {
  return {
    details: { sectionName: config.defaultUnit, scouterName: "", attendanceMonth: "", ...(raw?.details || {}) },
    roster: Array.isArray(raw?.roster) && raw.roster.length
      ? raw.roster.slice(0, MAX_ROSTER).map(person => ({ id: person.id || crypto.randomUUID(), name: person.name || "", prepaidDues: Math.max(0, Number(person.prepaidDues) || 0) }))
      : newRoster(),
    checks: raw?.checks || {}
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.sections) {
      return {
        activeSection: sectionConfigs[saved.activeSection] ? saved.activeSection : "beavers",
        shared: { ...defaultState.shared, ...(saved.shared || {}) },
        sections: Object.fromEntries(Object.entries(sectionConfigs).map(([key, config]) => [key, normalizeSection(saved.sections[key], config)])),
        inventory: normalizeInventory(saved.inventory)
      };
    }

    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY));
    if (legacy?.roster) {
      const migrated = cloneDefaults();
      migrated.shared.groupName = legacy.details?.groupName || migrated.shared.groupName;
      migrated.shared.scoutingYear = legacy.details?.scoutingYear || "";
      migrated.sections.beavers = {
        details: {
          sectionName: legacy.details?.colonyName || "",
          scouterName: legacy.details?.scouterName || ""
        },
        roster: legacy.roster.slice(0, MAX_ROSTER).map(person => ({ id: person.id || crypto.randomUUID(), name: person.name || "", prepaidDues: Math.max(0, Number(person.prepaidDues) || 0) })),
        checks: legacy.checks || {}
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch (error) {
    console.warn("Could not load saved tracker data.", error);
  }
  return cloneDefaults();
}

function activeConfig() { return sectionConfigs[state.activeSection]; }
function activeData() { return state.sections[state.activeSection]; }

function queueSave() {
  els.saveStatus.textContent = "Saving…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    els.saveStatus.textContent = "Saved";
  }, 250);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"}[char]));
}

function bindInputs() {
  els.groupName.addEventListener("input", event => {
    state.shared.groupName = event.target.value;
    queueSave();
    renderPrintBook();
  });
  els.scoutingYear.addEventListener("input", event => {
    state.shared.scoutingYear = event.target.value;
    queueSave();
    renderPrintBook();
  });
  els.sectionName.addEventListener("input", event => {
    activeData().details.sectionName = event.target.value;
    queueSave();
    renderPrintBook();
  });
  els.scouterName.addEventListener("input", event => {
    activeData().details.scouterName = event.target.value;
    queueSave();
    renderPrintBook();
  });
}

function syncControls() {
  const config = activeConfig();
  document.body.dataset.section = state.activeSection;
  const data = activeData();
  els.groupName.value = state.shared.groupName;
  els.scoutingYear.value = state.shared.scoutingYear;
  els.sectionName.value = data.details.sectionName;
  if (els.attendanceMonth) els.attendanceMonth.value = data.details.attendanceMonth || "";
  els.scouterName.value = data.details.scouterName;
  els.sectionNameLabel.querySelector("span").textContent = `${config.unitLabel} name`;
  els.sectionName.placeholder = `${config.unitLabel} name`;
  els.sectionHeading.textContent = `${config.label} record book`;
  els.rosterHeading.textContent = config.rosterLabel;
  els.addPersonBtn.textContent = `Add ${config.youthLabel}`;
  document.querySelectorAll(".section-tab").forEach(tab => {
    const active = tab.dataset.section === state.activeSection;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-current", active ? "page" : "false");
  });
}

function renderRosterEditor() {
  const config = activeConfig();
  const data = activeData();
  els.rosterEditor.innerHTML = "";
  data.roster.forEach((person, index) => {
    const row = els.rowTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.id = person.id;
    row.querySelector(".roster-number").textContent = index + 1;
    const input = row.querySelector(".roster-name");
    input.placeholder = `${config.youthLabel} name`;
    input.value = person.name;
    input.addEventListener("input", event => {
      person.name = event.target.value;
      queueSave();
      renderPrintBook();
    });
    const prepaid = row.querySelector(".roster-prepaid");
    prepaid.value = Number(person.prepaidDues || 0).toFixed(2);
    prepaid.addEventListener("change", event => {
      person.prepaidDues = Math.max(0, Number(event.target.value) || 0);
      event.target.value = person.prepaidDues.toFixed(2);
      queueSave();
      renderPrintBook();
    });
    row.querySelector(".move-up").disabled = index === 0;
    row.querySelector(".move-down").disabled = index === data.roster.length - 1;
    row.querySelector(".move-up").addEventListener("click", () => movePerson(index, -1));
    row.querySelector(".move-down").addEventListener("click", () => movePerson(index, 1));
    row.querySelector(".remove-person").setAttribute("aria-label", `Remove ${config.youthLabel}`);
    row.querySelector(".remove-person").addEventListener("click", () => removePerson(index));
    els.rosterEditor.appendChild(row);
  });
}

function movePerson(index, direction) {
  const roster = activeData().roster;
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= roster.length) return;
  [roster[index], roster[newIndex]] = [roster[newIndex], roster[index]];
  queueSave();
  renderAll();
}

function removePerson(index) {
  const roster = activeData().roster;
  roster.splice(index, 1);
  if (!roster.length) roster.push({ id: crypto.randomUUID(), name: "", prepaidDues: 0 });
  queueSave();
  renderAll();
}

function addPerson() {
  const roster = activeData().roster;
  if (roster.length >= MAX_ROSTER) {
    alert(`The printable layout supports up to ${MAX_ROSTER} youth per section.`);
    return;
  }
  roster.push({ id: crypto.randomUUID(), name: "", prepaidDues: 0 });
  queueSave();
  renderAll();
  els.rosterEditor.querySelectorAll(".roster-name")[roster.length - 1]?.focus();
}

function setSection(sectionKey) {
  if (!sectionConfigs[sectionKey] || sectionKey === state.activeSection) return;
  state.activeSection = sectionKey;
  queueSave();
  renderAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function metaRow() {
  const config = activeConfig();
  const data = activeData();
  return `<div class="meta-row">
    <div class="meta-box"><strong>Scouting Year:</strong> ${esc(state.shared.scoutingYear) || "________________"}</div>
    <div class="meta-box"><strong>${esc(config.unitLabel)}:</strong> ${esc(data.details.sectionName) || "________________"}</div>
    <div class="meta-box"><strong>Scouter:</strong> ${esc(data.details.scouterName) || "________________"}</div>
  </div>`;
}

function pageTitle(title, subtitle) {
  return `<div class="page-title section-${esc(state.activeSection)}">
    <div class="group">${esc(state.shared.groupName) || "Scout Group"} · ${esc(activeConfig().label)}</div>
    <h2>${esc(title)}</h2>
    <p>${esc(subtitle)}</p>
  </div>${metaRow()}`;
}

function personNameCell(person) {
  return person.name.trim() ? esc(person.name.trim()) : '<span class="empty-name">________________________</span>';
}

function checked(key) { return activeData().checks[key] ? "checked" : ""; }
function checkBox(key, label) {
  return `<input class="track-check" type="checkbox" data-check-key="${esc(key)}" aria-label="${esc(label)}" ${checked(key)}>`;
}

function overviewPage() {
  const config = activeConfig();
  const data = activeData();
  const progressionHeader = config.progressions.length > 3 ? "Personal Progression" : "Progression";
  const rows = data.roster.map((person, index) => {
    const progression = config.progressions.map(([key, label]) => `${checkBox(`overview:${person.id}:${key}`, `${person.name} ${label}`)} <span class="check-label">${esc(label)}</span>`).join(" ");
    return `<tr>
      <td>${index + 1}</td>
      <td class="name-col">${personNameCell(person)}</td>
      <td class="progression-col">${progression}</td>
      <td>${checkBox(`overview:${person.id}:${config.topAward[0]}`, `${person.name} ${config.topAward[1]}`)}</td>
      <td>${checkBox(`overview:${person.id}:${config.linkAward[0]}`, `${person.name} ${config.linkAward[1]}`)}</td>
      <td class="notes-col"></td>
    </tr>`;
  }).join("");

  return `<section class="print-page">${pageTitle(`${config.label} Overview`, "Personal progression and section awards")}
    <table class="tracker-table overview-table"><thead><tr>
      <th class="num-col">#</th><th class="name-col">${esc(config.youthLabel)}</th><th>${progressionHeader}</th>
      <th>${esc(config.topAward[1])}</th><th>${esc(config.linkAward[1])}</th><th class="notes-col">Notes</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <div class="progression-key">${config.progressions.map(([, label]) => `<span><strong>□</strong> ${esc(label)}</span>`).join("")}</div>
    <div class="footer-note">Unofficial section tracking resource. Confirm current requirements before awarding.</div>
  </section>`;
}

function pabPage() {
  const config = activeConfig();
  const data = activeData();
  const headers = config.badges.map(([abbr, name]) => `<th title="${esc(name)}">${esc(abbr)}</th>`).join("");
  const rows = data.roster.map((person, index) => `<tr>
    <td>${index + 1}</td><td class="name-col">${personNameCell(person)}</td>
    ${config.badges.map(([abbr, name]) => `<td>${checkBox(`pab:${person.id}:${abbr}`, `${person.name} ${name}`)}</td>`).join("")}
  </tr>`).join("");
  const key = config.badges.map(([abbr, name]) => `<div><strong>${esc(abbr)}</strong> — ${esc(name)}</div>`).join("");
  return `<section class="print-page">${pageTitle("Personal Achievement Badges", `All ${config.badges.length} ${config.label} Personal Achievement Badges`)}
    <table class="tracker-table badge-table"><thead><tr><th class="num-col">#</th><th class="name-col">${esc(config.youthLabel)}</th>${headers}</tr></thead><tbody>${rows}</tbody></table>
    <div class="badge-key">${key}</div>
    <div class="footer-note">Use each checkmark consistently for completed or awarded status.</div>
  </section>`;
}


function attendancePage() {
  const config = activeConfig();
  const data = activeData();
  const rows = data.roster.map((person, index) => `<tr>
    <td>${index + 1}</td>
    <td class="name-col">${personNameCell(person)}</td>
    <td class="attendance-prepaid">${Number(person.prepaidDues || 0) > 0 ? `$${Number(person.prepaidDues).toFixed(2)}` : ""}</td>
    ${Array.from({ length: 4 }, (_, meeting) => `
      <td class="attendance-date" aria-label="Meeting ${meeting + 1} date"></td>
      <td class="attendance-dues" aria-label="Meeting ${meeting + 1} dues"></td>`).join("")}
  </tr>`).join("");

  return `<section class="print-page attendance-page">${pageTitle("Attendance & Dues", "Monthly section attendance sheet")}
    <div class="attendance-month"><strong>Month:</strong><span>${esc(data.details.attendanceMonth || "")}</span></div>
    <table class="tracker-table attendance-table">
      <thead>
        <tr class="attendance-group-row">
          <th rowspan="2" class="num-col">#</th>
          <th rowspan="2" class="name-col">${esc(config.youthLabel)}</th>
          <th rowspan="2" class="attendance-prepaid">Prepaid</th>
          <th colspan="8">Month</th>
        </tr>
        <tr>
          ${Array.from({ length: 4 }, () => `<th>Date</th><th>Dues</th>`).join("")}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="attendance-notes"><strong>Notes:</strong></div>
    <div class="footer-note">Prepaid dues are carried from the youth record and remain unchanged month to month. Enter meeting dates, then mark attendance and any weekly dues by hand.</div>
  </section>`;
}

function oasPage(stream) {
  const config = activeConfig();
  const data = activeData();
  const slug = stream.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const stageHeaders = Array.from({ length: 9 }, (_, index) => `<th>Stage ${index + 1}</th>`).join("");
  const rows = data.roster.map((person, index) => `<tr>
    <td>${index + 1}</td><td class="name-col">${personNameCell(person)}</td>
    ${Array.from({ length: 9 }, (_, stage) => `<td>${checkBox(`oas:${slug}:${person.id}:${stage + 1}`, `${person.name} ${stream} Stage ${stage + 1}`)}</td>`).join("")}
    <td class="notes-col"></td>
  </tr>`).join("");
  return `<section class="print-page">${pageTitle(stream, "Outdoor Adventure Skills — Stages 1 through 9")}
    <table class="tracker-table oas-table"><thead><tr><th class="num-col">#</th><th class="name-col">${esc(config.youthLabel)}</th>${stageHeaders}<th class="notes-col">Notes</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="notes-area"><div class="notes-box"><strong>Program notes:</strong></div><div class="notes-box"><strong>Evidence / Scouter initials:</strong></div></div>
    <div class="footer-note">Check each stage as completed. OAS progress continues across sections.</div>
  </section>`;
}


const oasAbbreviations = {
  "Camping": "CAM",
  "Trail": "TRL",
  "Winter": "WIN",
  "Paddling": "PAD",
  "Aquatic": "AQU",
  "Vertical": "VRT",
  "Scoutcraft": "SCT",
  "Emergency": "EMG",
  "Sailing": "SAI"
};

function oasStagePage(stage) {
  const config = activeConfig();
  const data = activeData();
  const streamHeaders = oasStreams.map(stream => `<th title="${esc(stream)}">${esc(oasAbbreviations[stream] || stream.slice(0,3).toUpperCase())}</th>`).join("");
  const rows = data.roster.map((person, index) => `<tr>
    <td>${index + 1}</td>
    <td class="name-col">${personNameCell(person)}</td>
    ${oasStreams.map(stream => {
      const slug = slugify(stream);
      return `<td>${checkBox(`oas:${slug}:${person.id}:${stage}`, `${person.name} ${stream} Stage ${stage}`)}</td>`;
    }).join("")}
  </tr>`).join("");
  return `<section class="print-page oas-stage-page" data-oas-stage="${stage}">
    ${pageTitle(`OAS Stage ${stage}`, `All 9 Outdoor Adventure Skills — ${config.label}`)}
    <table class="tracker-table oas-stage-table">
      <thead><tr><th class="num-col">#</th><th class="name-col">${esc(config.youthLabel)}</th>${streamHeaders}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="oas-legend"><strong>Legend:</strong> ${oasStreams.map(stream => `<span><b>${esc(oasAbbreviations[stream] || stream.slice(0,3).toUpperCase())}</b> = ${esc(stream)}</span>`).join("")}</div>
    <div class="footer-note">Check each Outdoor Adventure Skill when Stage ${stage} is completed.</div>
  </section>`;
}

function printableOasStages() {
  return Array.from({ length: 9 }, (_, i) => oasStagePage(i + 1)).join("");
}

function renderPrintBook() {
  els.printBook.innerHTML = overviewPage() + attendancePage() + pabPage() + oasStreams.map(oasPage).join("");
  els.printBook.querySelectorAll(".track-check").forEach(box => {
    box.addEventListener("change", event => {
      activeData().checks[event.target.dataset.checkKey] = event.target.checked;
      queueSave();
      if (!document.getElementById("inventoryView").hidden) renderInventory();
    });
  });
}

function renderAll() {
  syncControls();
  renderRosterEditor();
  renderPrintBook();
}


function completionRecords() {
  const records = [];
  for (const [sectionKey, config] of Object.entries(sectionConfigs)) {
    const data = state.sections[sectionKey];
    for (const person of data.roster) {
      const youth = person.name.trim();
      if (!youth) continue;
      for (const [key, name] of config.progressions) {
        const checkKey = `overview:${person.id}:${key}`;
        if (data.checks[checkKey]) records.push(makeCompletion(sectionKey, checkKey, `${sectionKey}:progression:${key}`, youth, name));
      }
      for (const [key, name] of [config.topAward, config.linkAward]) {
        const checkKey = `overview:${person.id}:${key}`;
        if (data.checks[checkKey]) records.push(makeCompletion(sectionKey, checkKey, `${sectionKey}:award:${key}`, youth, name));
      }
      for (const [abbr, name] of config.badges) {
        const checkKey = `pab:${person.id}:${abbr}`;
        if (data.checks[checkKey]) records.push(makeCompletion(sectionKey, checkKey, `${sectionKey}:pab:${abbr}`, youth, name));
      }
      for (const stream of oasStreams) {
        const slug = slugify(stream);
        for (let stage = 1; stage <= 9; stage++) {
          const checkKey = `oas:${slug}:${person.id}:${stage}`;
          if (data.checks[checkKey]) records.push(makeCompletion(sectionKey, checkKey, `${sectionKey}:oas:${slug}:${stage}`, youth, `${stream} Stage ${stage}`));
        }
      }
    }
  }
  return records;
}

function makeCompletion(sectionKey, checkKey, badgeId, youth, badgeName) {
  const completionId = `${sectionKey}|${checkKey}`;
  return {
    completionId,
    sectionKey,
    sectionLabel: sectionConfigs[sectionKey].label,
    checkKey,
    badgeId,
    youth,
    badgeName,
    issued: Boolean(state.inventory.issued[completionId])
  };
}

function inventoryItem(id) {
  if (!state.inventory.items[id]) state.inventory.items[id] = { onHand: 0, reorderLevel: 0 };
  return state.inventory.items[id];
}

function inventoryMetrics(sectionKey = state.activeSection) {
  const completions = completionRecords().filter(record => record.sectionKey === sectionKey);
  const owed = completions.filter(record => !record.issued);
  const owedByBadge = {};
  owed.forEach(record => { owedByBadge[record.badgeId] = (owedByBadge[record.badgeId] || 0) + 1; });
  const rows = badgeCatalog
    .filter(badge => badge.section === sectionKey)
    .map(badge => {
      const item = inventoryItem(badge.id);
      const owedCount = owedByBadge[badge.id] || 0;
      const available = item.onHand - owedCount;
      const orderQty = Math.max(0, owedCount + item.reorderLevel - item.onHand);
      return { ...badge, onHand: item.onHand, reorderLevel: item.reorderLevel, owed: owedCount, available, orderQty };
    });
  return { completions, owed, rows };
}

function addTransaction(type, badgeId, qty, note = "", completionId = "") {
  state.inventory.transactions.push({
    id: crypto.randomUUID(), type, badgeId, qty, note, completionId,
    timestamp: new Date().toISOString()
  });
  state.inventory.transactions = state.inventory.transactions.slice(-500);
}

function receiveStock(badgeId) {
  const badge = badgeById[badgeId];
  const raw = prompt(`How many ${badge?.name || "badges"} were received?`, "1");
  if (raw === null) return;
  const qty = Math.floor(Number(raw));
  if (!Number.isFinite(qty) || qty <= 0) return alert("Enter a whole number greater than zero.");
  inventoryItem(badgeId).onHand += qty;
  addTransaction("receive", badgeId, qty, `Received ${qty}`);
  queueSave(); renderInventory();
}

function adjustStock(badgeId) {
  const badge = badgeById[badgeId];
  const current = inventoryItem(badgeId).onHand;
  const raw = prompt(`Set the physical on-hand count for ${badge?.name || "this badge"}.\nCurrent count: ${current}`, String(current));
  if (raw === null) return;
  const next = Math.floor(Number(raw));
  if (!Number.isFinite(next) || next < 0) return alert("Enter a whole number of zero or more.");
  const delta = next - current;
  inventoryItem(badgeId).onHand = next;
  if (delta) addTransaction("adjust", badgeId, delta, `Count adjusted from ${current} to ${next}`);
  queueSave(); renderInventory();
}

function setReserve(badgeId, value) {
  const next = Math.max(0, Math.floor(Number(value) || 0));
  inventoryItem(badgeId).reorderLevel = next;
  queueSave(); renderInventory();
}

function issueBadge(completionId) {
  const record = completionRecords().find(item => item.completionId === completionId);
  if (!record || record.issued) return;
  const item = inventoryItem(record.badgeId);
  if (item.onHand <= 0) return alert(`There are no ${record.badgeName} badges recorded on hand. Receive or adjust stock first.`);
  item.onHand -= 1;
  state.inventory.issued[completionId] = { issuedAt: new Date().toISOString(), badgeId: record.badgeId, youth: record.youth };
  addTransaction("issue", record.badgeId, -1, `Issued to ${record.youth} (${record.sectionLabel})`, completionId);
  queueSave(); renderInventory();
}

function undoIssue(completionId) {
  const issue = state.inventory.issued[completionId];
  if (!issue) return;
  const badgeId = issue.badgeId;
  inventoryItem(badgeId).onHand += 1;
  delete state.inventory.issued[completionId];
  addTransaction("undo", badgeId, 1, `Issue reversed for ${issue.youth || "youth"}`, completionId);
  queueSave(); renderInventory();
}

function showInventory() {
  document.getElementById("trackerSetup").hidden = true;
  document.getElementById("recordsView").hidden = true;
  document.getElementById("inventoryView").hidden = false;
  document.getElementById("inventoryBtn").textContent = "Back to attendance & badges";
  renderInventory();
  document.getElementById("inventoryView").scrollIntoView({ behavior: "smooth", block: "start" });
}

function showRecords() {
  document.getElementById("trackerSetup").hidden = false;
  document.getElementById("recordsView").hidden = false;
  document.getElementById("inventoryView").hidden = true;
  document.getElementById("inventoryBtn").textContent = "Badge inventory";
  document.getElementById("trackerSetup").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderInventory() {
  const sectionKey = state.activeSection;
  const sectionLabel = sectionConfigs[sectionKey].label;
  const title = document.getElementById("inventoryTitle");
  const note = document.getElementById("inventorySectionNote");
  if (title) title.textContent = `${sectionLabel} badge inventory`;
  if (note) note.textContent = `Only ${sectionLabel} stock is shown here. Earned badges are counted as owed until they are physically issued.`;

  const { owed, rows } = inventoryMetrics(sectionKey);
  const totalOnHand = rows.reduce((sum, row) => sum + row.onHand, 0);
  const totalOrder = rows.reduce((sum, row) => sum + row.orderQty, 0);
  const lowStock = rows.filter(row => row.orderQty > 0).length;
  const summary = document.getElementById("inventorySummary");
  summary.innerHTML = `
    <article><strong>${totalOnHand}</strong><span>Badges on hand</span></article>
    <article><strong>${owed.length}</strong><span>Badges owed</span></article>
    <article><strong>${lowStock}</strong><span>Stock lines to order</span></article>
    <article><strong>${totalOrder}</strong><span>Total badges to order</span></article>`;

  const owedList = document.getElementById("owedList");
  owedList.innerHTML = owed.length ? owed
    .sort((a,b) => a.sectionLabel.localeCompare(b.sectionLabel) || a.youth.localeCompare(b.youth) || a.badgeName.localeCompare(b.badgeName))
    .map(record => {
      const stock = inventoryItem(record.badgeId).onHand;
      return `<div class="owed-row"><div><strong>${esc(record.youth)}</strong><span>${esc(record.sectionLabel)} · ${esc(record.badgeName)}</span></div><div class="owed-stock">${stock} on hand</div><button class="button button-small ${stock > 0 ? "button-primary" : "button-disabled"}" data-issue="${esc(record.completionId)}" ${stock <= 0 ? "disabled" : ""}>Issue</button></div>`;
    }).join("") : `<p class="empty-state">No earned badges are currently waiting to be issued.</p>`;

  const tbody = document.getElementById("inventoryTableBody");
  tbody.innerHTML = rows.map(row => `<tr class="${row.orderQty > 0 ? "needs-order" : ""}">
    <td><strong>${esc(row.name)}</strong>${row.abbr ? `<small>${esc(row.abbr)}</small>` : ""}</td>
    <td>${esc(row.category)}</td>
    <td class="number-cell">${row.onHand}</td>
    <td class="number-cell">${row.owed}</td>
    <td class="number-cell ${row.available < 0 ? "negative" : ""}">${row.available}</td>
    <td><input class="reserve-input" type="number" min="0" step="1" value="${row.reorderLevel}" data-reserve="${esc(row.id)}" aria-label="Reserve level for ${esc(row.name)}"></td>
    <td class="number-cell order-cell">${row.orderQty || "—"}</td>
    <td class="inventory-row-actions"><button type="button" class="mini-button" data-receive="${esc(row.id)}">+ Stock</button><button type="button" class="mini-button" data-adjust="${esc(row.id)}">Set count</button></td>
  </tr>`).join("");

  owedList.querySelectorAll("[data-issue]").forEach(btn => btn.addEventListener("click", () => issueBadge(btn.dataset.issue)));
  tbody.querySelectorAll("[data-receive]").forEach(btn => btn.addEventListener("click", () => receiveStock(btn.dataset.receive)));
  tbody.querySelectorAll("[data-adjust]").forEach(btn => btn.addEventListener("click", () => adjustStock(btn.dataset.adjust)));
  tbody.querySelectorAll("[data-reserve]").forEach(input => input.addEventListener("change", () => setReserve(input.dataset.reserve, input.value)));

  const history = document.getElementById("inventoryHistory");
  const currentBadgeIds = new Set(badgeCatalog.filter(b => b.section === sectionKey).map(b => b.id));
  const recent = state.inventory.transactions
    .filter(tx => currentBadgeIds.has(tx.badgeId))
    .slice(-20)
    .reverse();
  history.innerHTML = recent.length ? recent.map(tx => {
    const badge = badgeById[tx.badgeId];
    const when = new Date(tx.timestamp).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
    const canUndo = tx.type === "issue" && tx.completionId && state.inventory.issued[tx.completionId];
    return `<div class="history-row"><div><strong>${esc(badge?.name || tx.badgeId)}</strong><span>${esc(tx.note)} · ${esc(when)}</span></div><div class="history-qty ${tx.qty < 0 ? "negative" : ""}">${tx.qty > 0 ? "+" : ""}${tx.qty}</div>${canUndo ? `<button class="mini-button" data-undo="${esc(tx.completionId)}">Undo issue</button>` : ""}</div>`;
  }).join("") : `<p class="empty-state">No inventory activity yet.</p>`;
  history.querySelectorAll("[data-undo]").forEach(btn => btn.addEventListener("click", () => undoIssue(btn.dataset.undo)));
}

function formatReportDate() {
  return new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

function reportHeader(title, subtitle) {
  return `<header class="report-header"><p>${esc(state.shared.groupName || "1st Sault Ste. Marie Scout Group")}</p><h1>${esc(title)}</h1><div><span>${esc(subtitle)}</span><span>Generated ${esc(formatReportDate())}</span><span>Scouting year: ${esc(state.shared.scoutingYear || "—")}</span></div></header>`;
}

function printableInventoryReport(orderOnly = false) {
  const sectionKey = state.activeSection;
  const sectionLabel = sectionConfigs[sectionKey].label;
  const { owed, rows } = inventoryMetrics(sectionKey);
  const shown = orderOnly ? rows.filter(row => row.orderQty > 0) : rows;
  const groups = [];

  const progressionAndPab = shown.filter(r => !r.id.includes(":oas:"));
  if (progressionAndPab.length) groups.push([`${sectionLabel} badges & progression`, progressionAndPab]);

  for (const stream of oasStreams) {
    const list = shown.filter(r => r.id.includes(`:oas:${slugify(stream)}:`));
    if (list.length) groups.push([`OAS — ${stream}`, list]);
  }

  const totalOnHand = rows.reduce((s,r) => s+r.onHand,0);
  const totalOrder = rows.reduce((s,r) => s+r.orderQty,0);
  const title = orderOnly ? `${sectionLabel} Badge Order Report` : `${sectionLabel} Badge Inventory Report`;
  const subtitle = orderOnly
    ? `Badges for ${sectionLabel} requiring purchase to cover earned badges and reserve stock`
    : `Physical ${sectionLabel} badge stock, outstanding awards, and reorder requirements`;

  const tables = groups.map(([group, list]) => `<section class="report-section"><h2>${esc(group)}</h2><table><thead><tr><th>Badge</th><th>Category</th><th>On Hand</th><th>Owed</th><th>Available</th><th>Reserve</th><th>Order Qty</th></tr></thead><tbody>${list.map(row => `<tr class="${row.orderQty > 0 ? "report-order" : ""}"><td>${esc(row.name)}</td><td>${esc(row.category)}</td><td>${row.onHand}</td><td>${row.owed}</td><td>${row.available}</td><td>${row.reorderLevel}</td><td><strong>${row.orderQty || "—"}</strong></td></tr>`).join("")}</tbody></table></section>`).join("");

  const orderSummary = rows.filter(r => r.orderQty > 0);
  return `<section class="inventory-report-page">${reportHeader(title, subtitle)}
    <div class="report-summary"><div><strong>${totalOnHand}</strong><span>On hand</span></div><div><strong>${owed.length}</strong><span>Owed</span></div><div><strong>${orderSummary.length}</strong><span>Lines to order</span></div><div><strong>${totalOrder}</strong><span>Badges to order</span></div></div>
    ${tables || `<p class="report-empty">No ${esc(sectionLabel)} badges currently need to be ordered.</p>`}
    ${!orderOnly && orderSummary.length ? `<section class="report-section order-summary"><h2>Shopping / Order Summary</h2><table><thead><tr><th>Badge</th><th>Order Qty</th></tr></thead><tbody>${orderSummary.map(row => `<tr><td>${esc(row.name)}</td><td><strong>${row.orderQty}</strong></td></tr>`).join("")}</tbody></table></section>` : ""}
    <footer>Order quantity = Owed + Reserve − On Hand, minimum zero. Inventory is tracked separately for each section.</footer>
  </section>`;
}

function printInventoryReport(orderOnly = false) {
  const reportBook = document.getElementById("reportBook");
  reportBook.innerHTML = printableInventoryReport(orderOnly);
  document.body.classList.add("printing-report");
  const cleanup = () => { document.body.classList.remove("printing-report"); window.removeEventListener("afterprint", cleanup); };
  window.addEventListener("afterprint", cleanup);
  window.print();
  setTimeout(cleanup, 1000);
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `scout-group-badge-tracker-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported?.sections) throw new Error("Invalid backup");
      state = {
        activeSection: sectionConfigs[imported.activeSection] ? imported.activeSection : "beavers",
        shared: { ...defaultState.shared, ...(imported.shared || {}) },
        sections: Object.fromEntries(Object.entries(sectionConfigs).map(([key, config]) => [key, normalizeSection(imported.sections[key], config)])),
        inventory: normalizeInventory(imported.inventory)
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      renderAll();
      els.saveStatus.textContent = "Imported";
    } catch {
      alert("That file is not a valid Scout Group Badge Tracker backup.");
    }
  };
  reader.readAsText(file);
}

function resetSelectedSection() {
  const config = activeConfig();
  if (!confirm(`Clear all ${config.label} names, checkmarks, and section details on this device? Other sections will not be changed.`)) return;
  state.sections[state.activeSection] = newSectionState(config);
  renderAll();
  queueSave();
}


let pendingPrintAction = null;

function applyPrintOrientation(orientation) {
  let style = document.getElementById("dynamicPrintOrientation");
  if (!style) {
    style = document.createElement("style");
    style.id = "dynamicPrintOrientation";
    document.head.appendChild(style);
  }
  style.textContent = `@media print { @page { size: letter ${orientation}; margin: .28in; } }`;
}

function openPrintOrientationModal(printAction) {
  pendingPrintAction = printAction;
  const modal = document.getElementById("printOrientationModal");
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closePrintOrientationModal() {
  document.getElementById("printOrientationModal").hidden = true;
  document.body.classList.remove("modal-open");
  pendingPrintAction = null;
}

function choosePrintOrientation(orientation) {
  const action = pendingPrintAction;
  applyPrintOrientation(orientation);
  closePrintOrientationModal();
  if (typeof action === "function") {
    requestAnimationFrame(() => requestAnimationFrame(action));
  }
}

document.querySelectorAll(".orientation-choice").forEach(button => {
  button.addEventListener("click", () => choosePrintOrientation(button.dataset.orientation));
});
document.getElementById("printModalClose").addEventListener("click", closePrintOrientationModal);
document.querySelector("[data-close-print-modal]").addEventListener("click", closePrintOrientationModal);
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !document.getElementById("printOrientationModal").hidden) {
    closePrintOrientationModal();
  }
});

if (els.attendanceMonth) {
  els.attendanceMonth.addEventListener("input", event => {
    activeData().details.attendanceMonth = event.target.value;
    queueSave();
    renderPrintBook();
  });
}

bindInputs();
renderAll();
document.querySelectorAll(".section-tab").forEach(tab => tab.addEventListener("click", () => {
  showRecords();
  setSection(tab.dataset.section);
}));
els.addPersonBtn.addEventListener("click", addPerson);
document.getElementById("printBtn").addEventListener("click", () => {
  openPrintOrientationModal(() => {
    document.body.classList.remove("printing-report", "printing-attendance", "printing-oas-stages");
    window.print();
  });
});


document.getElementById("printOasStagesBtn").addEventListener("click", () => {
  openPrintOrientationModal(() => {
      const existing = document.getElementById("oasStagePrintBook");
      if (existing) existing.remove();
      const book = document.createElement("div");
      book.id = "oasStagePrintBook";
      book.className = "oas-stage-print-book";
      book.innerHTML = printableOasStages();
      document.body.appendChild(book);
      book.querySelectorAll(".track-check").forEach(box => {
        box.addEventListener("change", event => {
          activeData().checks[event.target.dataset.checkKey] = event.target.checked;
          queueSave();
        });
      });
      document.body.classList.remove("printing-report", "printing-attendance");
      document.body.classList.add("printing-oas-stages");
      const cleanup = () => {
        document.body.classList.remove("printing-oas-stages");
        book.remove();
        window.removeEventListener("afterprint", cleanup);
      };
      window.addEventListener("afterprint", cleanup);
      window.print();
  });
});

document.getElementById("printAttendanceBtn").addEventListener("click", () => {
  openPrintOrientationModal(() => {
    document.body.classList.remove("printing-report", "printing-oas-stages");
    document.body.classList.add("printing-attendance");
    const cleanup = () => {
      document.body.classList.remove("printing-attendance");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  });
});
document.getElementById("inventoryBtn").addEventListener("click", () => {
  const inventoryOpen = !document.getElementById("inventoryView").hidden;
  if (inventoryOpen) showRecords();
  else showInventory();
});
document.getElementById("recordsBtn").addEventListener("click", showRecords);
document.getElementById("printInventoryBtn").addEventListener("click", () => openPrintOrientationModal(() => printInventoryReport(false)));
document.getElementById("printOrderBtn").addEventListener("click", () => openPrintOrientationModal(() => printInventoryReport(true)));
document.getElementById("exportBtn").addEventListener("click", exportBackup);
document.getElementById("resetBtn").addEventListener("click", resetSelectedSection);
document.getElementById("importFile").addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (file) importBackup(file);
  event.target.value = "";
});
