const STORAGE_KEY = "share-split:v1";
const SYNC_URL_KEY = "share-split:sync-url";
const EMOJI_OPTIONS = ["💸", "🍽️", "🏖️", "🏠", "🚕", "🎁", "🎉", "🧾", "☕", "🍕", "✈️", "🛒", "🎬", "🏕️", "⚽", "💡"];
const CONTRIBUTOR_PERCENTAGES = [20, 50, 70, 100];
const CURRENCY_OPTIONS = [
  { code: "USD", label: "USD $" },
  { code: "EUR", label: "EUR €" },
  { code: "GBP", label: "GBP £" },
  { code: "CAD", label: "CAD $" },
  { code: "AUD", label: "AUD $" },
  { code: "AED", label: "AED" },
  { code: "IRR", label: "IRR" },
  { code: "TRY", label: "TRY ₺" },
];

const state = loadState();

const elements = {
  homeButton: document.querySelector("#homeButton"),
  newShareButton: document.querySelector("#newShareButton"),
  syncUrl: document.querySelector("#syncUrl"),
  syncStatus: document.querySelector("#syncStatus"),
  connectSyncButton: document.querySelector("#connectSyncButton"),
  loadSyncButton: document.querySelector("#loadSyncButton"),
  saveSyncButton: document.querySelector("#saveSyncButton"),
  shareForm: document.querySelector("#shareForm"),
  shareName: document.querySelector("#shareName"),
  shareEmoji: document.querySelector("#shareEmoji"),
  emojiPickerButton: document.querySelector("#emojiPickerButton"),
  emojiPicker: document.querySelector("#emojiPicker"),
  shareList: document.querySelector("#shareList"),
  landingPage: document.querySelector("#landingPage"),
  sharePage: document.querySelector("#sharePage"),
  landingShareCount: document.querySelector("#landingShareCount"),
  landingShareList: document.querySelector("#landingShareList"),
  activeShareTitle: document.querySelector("#activeShareTitle"),
  activeShareNameInput: document.querySelector("#activeShareNameInput"),
  activeShareEmoji: document.querySelector("#activeShareEmoji"),
  activeShareEmojiButton: document.querySelector("#activeShareEmojiButton"),
  activeShareEmojiPicker: document.querySelector("#activeShareEmojiPicker"),
  currencySelect: document.querySelector("#currencySelect"),
  exportButton: document.querySelector("#exportButton"),
  deleteShareButton: document.querySelector("#deleteShareButton"),
  personForm: document.querySelector("#personForm"),
  personName: document.querySelector("#personName"),
  peopleCount: document.querySelector("#peopleCount"),
  personList: document.querySelector("#personList"),
  expenseForm: document.querySelector("#expenseForm"),
  expenseDate: document.querySelector("#expenseDate"),
  expenseSubject: document.querySelector("#expenseSubject"),
  expensePayer: document.querySelector("#expensePayer"),
  expenseAmount: document.querySelector("#expenseAmount"),
  expenseSubmitButton: document.querySelector("#expenseSubmitButton"),
  cancelExpenseEditButton: document.querySelector("#cancelExpenseEditButton"),
  contributorsList: document.querySelector("#contributorsList"),
  expenseCount: document.querySelector("#expenseCount"),
  expenseTable: document.querySelector("#expenseTable"),
  totalAmount: document.querySelector("#totalAmount"),
  balanceList: document.querySelector("#balanceList"),
  settlementCount: document.querySelector("#settlementCount"),
  settlementList: document.querySelector("#settlementList"),
  emptyStateTemplate: document.querySelector("#emptyStateTemplate"),
};

let editingExpenseId = null;

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (
        parsed &&
        typeof parsed.activeShareId === "string" &&
        Array.isArray(parsed.shares) &&
        parsed.shares.length > 0 &&
        parsed.shares.every(
          (share) =>
            typeof share.id === "string" &&
            typeof share.name === "string" &&
            Array.isArray(share.people) &&
            Array.isArray(share.expenses),
        )
      ) {
        return parsed;
      }
    } catch {
      // fall through to remove and reset
    }
    localStorage.removeItem(STORAGE_KEY);
  }

  const initialShare = {
    id: crypto.randomUUID(),
    name: "Dinner share",
    emoji: "🍽️",
    currency: "USD",
    people: [
      { id: crypto.randomUUID(), name: "Alex" },
      { id: crypto.randomUUID(), name: "Sam" },
      { id: crypto.randomUUID(), name: "Taylor" },
    ],
    expenses: [],
  };

  return {
    activeShareId: initialShare.id,
    shares: [initialShare],
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function savedSyncUrl() {
  return localStorage.getItem(SYNC_URL_KEY) || "";
}

function currentSyncUrl() {
  return elements.syncUrl.value.trim() || savedSyncUrl();
}

function setSyncStatus(message, type = "muted") {
  elements.syncStatus.textContent = message;
  elements.syncStatus.dataset.type = type;
}

function isScriptUrl(url) {
  return url.startsWith("https://script.google.com/");
}

function connectSyncUrl() {
  const url = elements.syncUrl.value.trim();
  if (!url) {
    setSyncStatus("Paste your Apps Script URL first", "error");
    return false;
  }

  if (!isScriptUrl(url)) {
    setSyncStatus("URL must be a Google Apps Script web app URL", "error");
    return false;
  }

  localStorage.setItem(SYNC_URL_KEY, url);
  setSyncStatus("Connected to Google Drive", "success");
  return true;
}

function loadStateFromDrive() {
  const url = currentSyncUrl();
  if (!url) {
    setSyncStatus("Paste your Apps Script URL first", "error");
    return;
  }

  if (!isScriptUrl(url)) {
    setSyncStatus("URL must be a Google Apps Script web app URL", "error");
    return;
  }

  localStorage.setItem(SYNC_URL_KEY, url);
  setSyncStatus("Loading from Drive...");

  const callbackName = `shareSplitLoad${Date.now()}${Math.random().toString(36).slice(2)}`;
  const script = document.createElement("script");
  const separator = url.includes("?") ? "&" : "?";

  const cleanup = () => {
    clearTimeout(timeoutId);
    delete window[callbackName];
    script.remove();
  };

  const timeoutId = setTimeout(() => {
    cleanup();
    setSyncStatus("Drive request timed out", "error");
  }, 10000);

  window[callbackName] = (response) => {
    cleanup();

    if (!response?.ok) {
      setSyncStatus(response?.error || "Drive data was not valid", "error");
      return;
    }

    if (!response.data) {
      setSyncStatus("No Drive data yet. Click Save first.", "error");
      return;
    }

    if (!isValidRemoteState(response.data)) {
      setSyncStatus("Drive data was not valid", "error");
      return;
    }

    state.activeShareId = response.data.activeShareId;
    state.shares = response.data.shares;
    saveState();
    setSyncStatus("Loaded from Google Drive", "success");
    goToShare(state.activeShareId);
  };

  script.onerror = () => {
    cleanup();
    setSyncStatus("Could not load from Drive", "error");
  };

  script.src = `${url}${separator}action=load&callback=${encodeURIComponent(callbackName)}&t=${Date.now()}`;
  document.body.append(script);
}

function saveStateToDrive() {
  const url = currentSyncUrl();
  if (!url) {
    setSyncStatus("Paste your Apps Script URL first", "error");
    return;
  }

  if (!isScriptUrl(url)) {
    setSyncStatus("URL must be a Google Apps Script web app URL", "error");
    return;
  }

  localStorage.setItem(SYNC_URL_KEY, url);
  saveState();
  setSyncStatus("Saving to Drive...");

  const iframeName = "shareSplitSyncFrame";
  const existing = document.querySelector(`iframe[name="${iframeName}"]`);
  if (existing) existing.remove();

  const iframe = document.createElement("iframe");
  iframe.name = iframeName;
  iframe.hidden = true;
  document.body.append(iframe);

  const form = document.createElement("form");
  form.method = "POST";
  form.action = url;
  form.target = iframeName;
  form.hidden = true;

  const actionInput = document.createElement("input");
  actionInput.name = "action";
  actionInput.value = "save";

  const dataInput = document.createElement("input");
  dataInput.name = "data";
  dataInput.value = JSON.stringify(state);

  form.append(actionInput, dataInput);
  document.body.append(form);
  form.submit();
  form.remove();

  iframe.addEventListener("load", () => setSyncStatus("Saved to Google Drive", "success"), { once: true });
}

function isValidRemoteState(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof value.activeShareId === "string" &&
      Array.isArray(value.shares) &&
      value.shares.length > 0 &&
      value.shares.some((share) => share.id === value.activeShareId) &&
      value.shares.every(
        (share) =>
          typeof share.id === "string" &&
          typeof share.name === "string" &&
          Array.isArray(share.people) &&
          Array.isArray(share.expenses) &&
          share.people.every((p) => typeof p.id === "string" && typeof p.name === "string") &&
          share.expenses.every((e) => typeof e.id === "string" && typeof e.date === "string" && typeof e.amount === "number"),
      ),
  );
}

function activeShare() {
  return state.shares.find((share) => share.id === state.activeShareId) ?? state.shares[0];
}

function currentRoute() {
  const hash = window.location.hash || "#home";
  const shareMatch = hash.match(/^#share\/(.+)$/);
  if (shareMatch) {
    return { page: "share", shareId: decodeURIComponent(shareMatch[1]) };
  }
  return { page: "home" };
}

function goHome() {
  window.location.hash = "#home";
}

function goToShare(shareId) {
  window.location.hash = `#share/${encodeURIComponent(shareId)}`;
}

function shareCurrency(share) {
  return CURRENCY_OPTIONS.some((currency) => currency.code === share?.currency) ? share.currency : "USD";
}

function money(value, currency = shareCurrency(activeShare())) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(value);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function createEmptyState(title, text) {
  const node = elements.emptyStateTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector("strong").textContent = title;
  node.querySelector("span").textContent = text;
  return node;
}

function personName(share, personId) {
  return share.people.find((person) => person.id === personId)?.name ?? "Unknown";
}

function calculate(share) {
  const balances = new Map();
  share.people.forEach((person) => {
    balances.set(person.id, {
      id: person.id,
      name: person.name,
      paid: 0,
      owed: 0,
      balance: 0,
    });
  });

  let total = 0;

  share.expenses.forEach((expense) => {
    total += expense.amount;
    const payer = balances.get(expense.personId);
    const contributorIds = validContributorIds(share, expense);
    const percentages = contributorPercentages(share, expense, contributorIds);
    const totalPercentage = contributorIds.reduce((sum, personId) => sum + percentages[personId], 0);

    if (payer) {
      payer.paid += expense.amount;
    }

    contributorIds.forEach((personId) => {
      const contributor = balances.get(personId);
      if (contributor && totalPercentage) {
        contributor.owed += expense.amount * (percentages[personId] / totalPercentage);
      }
    });
  });

  balances.forEach((balance) => {
    balance.balance = roundMoney(balance.paid - balance.owed);
  });

  return {
    total: roundMoney(total),
    balances: [...balances.values()],
    settlements: settle([...balances.values()]),
  };
}

function validContributorIds(share, expense) {
  const peopleIds = new Set(share.people.map((person) => person.id));
  const storedIds = Array.isArray(expense.contributorIds) ? expense.contributorIds : share.people.map((person) => person.id);
  return storedIds.filter((personId) => peopleIds.has(personId));
}

function contributorPercentages(share, expense, ids = validContributorIds(share, expense)) {
  const stored = expense.contributorPercentages && typeof expense.contributorPercentages === "object" ? expense.contributorPercentages : {};

  return ids.reduce((percentages, personId) => {
    const value = Number(stored[personId]);
    percentages[personId] = CONTRIBUTOR_PERCENTAGES.includes(value) ? value : 100;
    return percentages;
  }, {});
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function settle(balances) {
  const debtors = balances
    .filter((item) => item.balance < -0.009)
    .map((item) => ({ ...item, amount: Math.abs(item.balance) }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = balances
    .filter((item) => item.balance > 0.009)
    .map((item) => ({ ...item, amount: item.balance }))
    .sort((a, b) => b.amount - a.amount);

  const payments = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = roundMoney(Math.min(debtor.amount, creditor.amount));

    if (amount > 0) {
      payments.push({
        from: debtor.name,
        to: creditor.name,
        amount,
      });
    }

    debtor.amount = roundMoney(debtor.amount - amount);
    creditor.amount = roundMoney(creditor.amount - amount);

    if (debtor.amount <= 0.009) debtorIndex += 1;
    if (creditor.amount <= 0.009) creditorIndex += 1;
  }

  return payments;
}

function render() {
  const route = currentRoute();
  const requestedShare = route.page === "share" ? state.shares.find((share) => share.id === route.shareId) : null;
  const share = requestedShare ?? activeShare();

  if (!share) return;

  elements.expenseDate.value ||= today();
  renderShares(share);

  if (route.page === "share" && requestedShare) {
    elements.landingPage.hidden = true;
    elements.sharePage.hidden = false;
    renderHeader(share);
    renderPeople(share);
    renderExpenses(share);
    renderResults(share);
  } else {
    renderLanding();
    elements.landingPage.hidden = false;
    elements.sharePage.hidden = true;
  }

  saveState();
}

function renderShares(active) {
  elements.shareList.replaceChildren();

  state.shares.forEach((share) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `share-card${share.id === active.id ? " active" : ""}`;
    button.dataset.shareId = share.id;
    button.innerHTML = `
      <span class="share-icon">${escapeHtml(share.emoji || "💸")}</span>
      <span>
        <strong>${escapeHtml(share.name)}</strong>
        <span>${share.people.length} people · ${share.expenses.length} amounts</span>
      </span>
    `;
    button.addEventListener("click", () => {
      state.activeShareId = share.id;
      goToShare(share.id);
    });
    elements.shareList.append(button);
  });
}

function renderLanding() {
  elements.landingShareCount.textContent = `${state.shares.length} total`;
  elements.landingShareList.replaceChildren();

  state.shares.forEach((share) => {
    const result = calculate(share);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "landing-share-card";
    card.innerHTML = `
      <span class="share-icon">${escapeHtml(share.emoji || "💸")}</span>
      <span>
        <strong>${escapeHtml(share.name)}</strong>
        <span>${share.people.length} people · ${share.expenses.length} rows · ${money(result.total, shareCurrency(share))} total</span>
      </span>
      <span class="open-arrow">→</span>
    `;
    card.addEventListener("click", () => goToShare(share.id));
    elements.landingShareList.append(card);
  });
}

function renderHeader(share) {
  const emoji = share.emoji || "💸";
  elements.activeShareEmoji.value = emoji;
  elements.activeShareEmojiButton.textContent = emoji;
  if (document.activeElement !== elements.activeShareNameInput) {
    elements.activeShareNameInput.value = share.name;
  }
  elements.currencySelect.value = shareCurrency(share);
  elements.deleteShareButton.disabled = state.shares.length <= 1;
}

function saveInlineShareName() {
  const share = activeShare();
  const name = elements.activeShareNameInput.value.trim();

  if (!name) {
    elements.activeShareNameInput.value = share.name;
    return;
  }

  if (share.name !== name) {
    share.name = name;
    render();
  }
}

function setExpenseFormMode(expenseId = null) {
  editingExpenseId = expenseId;
  elements.expenseForm.classList.toggle("is-editing", Boolean(editingExpenseId));
  elements.expenseSubmitButton.textContent = editingExpenseId ? "Update amount" : "Add amount";
  elements.cancelExpenseEditButton.hidden = !editingExpenseId;
}

function resetContributorControls() {
  elements.contributorsList.querySelectorAll(".contributor-option").forEach((option) => {
    const checkbox = option.querySelector('input[name="contributors"]');
    const percentageInputs = [...option.querySelectorAll('input[type="radio"]')];
    checkbox.checked = true;
    percentageInputs.forEach((input) => {
      input.disabled = false;
      input.checked = Number(input.value) === 100;
    });
  });
}

function setContributorControlsForExpense(share, expense) {
  const ids = validContributorIds(share, expense);
  const percentages = contributorPercentages(share, expense);

  elements.contributorsList.querySelectorAll(".contributor-option").forEach((option) => {
    const checkbox = option.querySelector('input[name="contributors"]');
    const percentageInputs = [...option.querySelectorAll('input[type="radio"]')];
    const personId = checkbox.value;
    const isContributor = ids.includes(personId);
    checkbox.checked = isContributor;
    percentageInputs.forEach((input) => {
      input.disabled = !isContributor;
      input.checked = Number(input.value) === percentages[personId];
    });
  });
}

function resetExpenseForm() {
  elements.expenseSubject.value = "";
  elements.expenseAmount.value = "";
  resetContributorControls();
  setExpenseFormMode();
}

function startExpenseEdit(share, expenseId) {
  const expense = share.expenses.find((item) => item.id === expenseId);
  if (!expense) return;

  elements.expenseDate.value = expense.date || today();
  elements.expenseSubject.value = expense.subject;
  elements.expensePayer.value = share.people.some((person) => person.id === expense.personId) ? expense.personId : share.people[0]?.id || "";
  elements.expenseAmount.value = expense.amount;
  setContributorControlsForExpense(share, expense);
  setExpenseFormMode(expenseId);
  elements.expenseSubject.focus();
}

function renderPeople(share) {
  elements.peopleCount.textContent = `${share.people.length} total`;
  elements.personList.replaceChildren();
  elements.expensePayer.replaceChildren();
  elements.contributorsList.replaceChildren();
  elements.expenseSubmitButton.disabled = share.people.length === 0;

  if (!share.people.length) {
    elements.personList.append(createEmptyState("No people yet", "Add names before entering amounts."));
    elements.contributorsList.append(createEmptyState("No contributors", "Add people before selecting contributors."));
    const option = document.createElement("option");
    option.textContent = "Add a person first";
    option.value = "";
    elements.expensePayer.append(option);
    return;
  }

  share.people.forEach((person) => {
    const pill = document.createElement("div");
    pill.className = "person-pill";
    pill.innerHTML = `
      <span class="person-name">${escapeHtml(person.name)}</span>
      <button class="mini-button" type="button" title="Remove ${escapeHtml(person.name)}" aria-label="Remove ${escapeHtml(person.name)}">×</button>
    `;
    pill.querySelector("button").addEventListener("click", () => removePerson(share, person.id));
    elements.personList.append(pill);

    const option = document.createElement("option");
    option.value = person.id;
    option.textContent = person.name;
    elements.expensePayer.append(option);

    const contributor = document.createElement("div");
    contributor.className = "contributor-option";
    contributor.innerHTML = `
      <label class="contributor-person">
        <input type="checkbox" name="contributors" value="${escapeHtml(person.id)}" checked />
        <span>${escapeHtml(person.name)}</span>
      </label>
      <div class="percentage-line" aria-label="${escapeHtml(person.name)} percentage">
        ${CONTRIBUTOR_PERCENTAGES.map(
          (percentage) => `
            <label class="percentage-choice" aria-label="${percentage}%">
              <input type="radio" name="contributorPercentage-${escapeHtml(person.id)}" value="${percentage}"${percentage === 100 ? " checked" : ""} />
            </label>
          `,
        ).join("")}
      </div>
    `;
    const checkbox = contributor.querySelector('input[name="contributors"]');
    const percentageInputs = [...contributor.querySelectorAll('input[type="radio"]')];
    checkbox.addEventListener("change", () => {
      percentageInputs.forEach((input) => {
        input.disabled = !checkbox.checked;
      });
    });
    elements.contributorsList.append(contributor);
  });
}

function renderExpenses(share) {
  elements.expenseCount.textContent = `${share.expenses.length} rows`;
  elements.expenseTable.replaceChildren();

  if (!share.expenses.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="6"><div class="empty-state"><strong>No amounts yet</strong><span>Add the first amount above.</span></div></td>`;
    elements.expenseTable.append(row);
    return;
  }

  const currency = shareCurrency(share);

  [...share.expenses]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((expense) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(expense.date)}</td>
        <td>${escapeHtml(expense.subject)}</td>
        <td>${escapeHtml(personName(share, expense.personId))}</td>
        <td>${escapeHtml(contributorNames(share, expense))}</td>
        <td class="number-cell">${money(expense.amount, currency)}</td>
        <td class="number-cell">
          <div class="expense-actions">
            <button class="mini-button" type="button" title="Edit amount" aria-label="Edit amount">Edit</button>
            <button class="mini-button" type="button" title="Remove amount" aria-label="Remove amount">×</button>
          </div>
        </td>
      `;
      const [editButton, removeButton] = row.querySelectorAll("button");
      editButton.addEventListener("click", () => startExpenseEdit(share, expense.id));
      removeButton.addEventListener("click", () => {
        share.expenses = share.expenses.filter((item) => item.id !== expense.id);
        if (editingExpenseId === expense.id) {
          resetExpenseForm();
        }
        render();
      });
      elements.expenseTable.append(row);
    });
}

function contributorNames(share, expense) {
  const ids = validContributorIds(share, expense);
  if (!ids.length) return "No contributors";
  const percentages = contributorPercentages(share, expense, ids);
  const allAtFullShare = ids.every((personId) => percentages[personId] === 100);
  if (ids.length === share.people.length && allAtFullShare) return "Everyone";
  return ids.map((personId) => {
    const suffix = percentages[personId] === 100 ? "" : ` ${percentages[personId]}%`;
    return `${personName(share, personId)}${suffix}`;
  }).join(", ");
}

function renderResults(share) {
  const result = calculate(share);
  const currency = shareCurrency(share);
  elements.totalAmount.textContent = `${money(result.total, currency)} total`;
  elements.settlementCount.textContent = `${result.settlements.length} transfers`;
  elements.balanceList.replaceChildren();
  elements.settlementList.replaceChildren();

  if (!share.people.length) {
    elements.balanceList.append(createEmptyState("No share yet", "Balances appear after people are added."));
    elements.settlementList.append(createEmptyState("No payments", "Add people and amounts to calculate payments."));
    return;
  }

  result.balances.forEach((balance) => {
    const item = document.createElement("div");
    const status = balance.balance > 0.009 ? "positive" : balance.balance < -0.009 ? "negative" : "neutral";
    const label = balance.balance > 0.009 ? "gets back" : balance.balance < -0.009 ? "should pay" : "settled";
    item.className = "balance-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(balance.name)}</strong>
        <span class="balance-meta">Paid ${money(balance.paid, currency)} · Share ${money(balance.owed, currency)}</span>
      </div>
      <span class="balance-value ${status}">${label} ${money(Math.abs(balance.balance), currency)}</span>
    `;
    elements.balanceList.append(item);
  });

  if (!result.settlements.length) {
    elements.settlementList.append(createEmptyState("All settled", "No one needs to pay anyone."));
    return;
  }

  result.settlements.forEach((payment) => {
    const item = document.createElement("div");
    item.className = "settlement-item";
    item.innerHTML = `
      <strong>${escapeHtml(payment.from)} pays ${escapeHtml(payment.to)} ${money(payment.amount, currency)}</strong>
      <span>Balances after this transfer move closer to zero.</span>
    `;
    elements.settlementList.append(item);
  });
}

function removePerson(share, personId) {
  if (share.expenses.some((expense) => expense.personId === personId || validContributorIds(share, expense).includes(personId))) {
    alert("Remove this person's amounts or contributor selections before removing the person.");
    return;
  }

  share.people = share.people.filter((person) => person.id !== personId);
  render();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

elements.newShareButton.addEventListener("click", () => {
  elements.shareName.focus();
});

elements.homeButton.addEventListener("click", goHome);

elements.connectSyncButton.addEventListener("click", connectSyncUrl);
elements.loadSyncButton.addEventListener("click", loadStateFromDrive);
elements.saveSyncButton.addEventListener("click", saveStateToDrive);

function renderEmojiPicker(picker, buttonElement, inputElement, onSelect) {
  picker.replaceChildren();
  EMOJI_OPTIONS.forEach((emoji) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "emoji-option";
    button.textContent = emoji;
    button.setAttribute("aria-label", `Use ${emoji}`);
    button.addEventListener("click", () => {
      inputElement.value = emoji;
      buttonElement.textContent = emoji;
      picker.hidden = true;
      onSelect?.(emoji);
    });
    picker.append(button);
  });
}

elements.emojiPickerButton.addEventListener("click", () => {
  elements.emojiPicker.hidden = !elements.emojiPicker.hidden;
});

elements.activeShareEmojiButton.addEventListener("click", () => {
  elements.activeShareEmojiPicker.hidden = !elements.activeShareEmojiPicker.hidden;
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".emoji-picker-wrap")) {
    elements.emojiPicker.hidden = true;
    elements.activeShareEmojiPicker.hidden = true;
  }
});

elements.activeShareNameInput.addEventListener("blur", saveInlineShareName);
elements.activeShareNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    elements.activeShareNameInput.blur();
  }
  if (event.key === "Escape") {
    elements.activeShareNameInput.value = activeShare().name;
    elements.activeShareNameInput.blur();
  }
});

elements.shareForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = elements.shareName.value.trim();
  const emoji = elements.shareEmoji.value.trim() || "💸";

  if (!name) return;

  const share = {
    id: crypto.randomUUID(),
    name,
    emoji,
    currency: "USD",
    people: [],
    expenses: [],
  };

  state.shares.unshift(share);
  state.activeShareId = share.id;
  elements.shareForm.reset();
  elements.shareEmoji.value = "💸";
  elements.emojiPickerButton.textContent = "💸";
  elements.emojiPicker.hidden = true;
  goToShare(share.id);
});

elements.personForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const share = activeShare();
  const name = elements.personName.value.trim();

  if (!name || share.people.some((person) => person.name.toLowerCase() === name.toLowerCase())) {
    return;
  }

  share.people.push({ id: crypto.randomUUID(), name });
  elements.personForm.reset();
  render();
});

elements.expenseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const share = activeShare();
  const amount = Number(elements.expenseAmount.value);
  const contributorIds = [...elements.contributorsList.querySelectorAll('input[name="contributors"]:checked')].map((input) => input.value);
  const contributorPercentageMap = contributorIds.reduce((percentages, personId) => {
    const option = [...elements.contributorsList.querySelectorAll(".contributor-option")].find((item) => item.querySelector('input[name="contributors"]')?.value === personId);
    const value = Number(option?.querySelector('input[type="radio"]:checked')?.value);
    percentages[personId] = CONTRIBUTOR_PERCENTAGES.includes(value) ? value : 100;
    return percentages;
  }, {});

  if (!share.people.length) {
    alert("Add people before entering amounts.");
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    alert("Enter a valid amount greater than zero.");
    return;
  }

  if (!contributorIds.length) {
    alert("Select at least one contributor for this amount.");
    return;
  }

  const payerId = elements.expensePayer.value;
  if (!payerId || !share.people.some((p) => p.id === payerId)) {
    alert("Select a valid payer.");
    return;
  }

  const subject = elements.expenseSubject.value.trim();
  if (!subject) {
    alert("Enter a subject for this amount.");
    return;
  }

  const expenseData = {
    date: elements.expenseDate.value || today(),
    subject,
    personId: payerId,
    contributorIds,
    contributorPercentages: contributorPercentageMap,
    amount: roundMoney(amount),
  };

  if (editingExpenseId) {
    const expense = share.expenses.find((item) => item.id === editingExpenseId);
    if (expense) {
      Object.assign(expense, expenseData);
    }
  } else {
    share.expenses.push({
      id: crypto.randomUUID(),
      ...expenseData,
    });
  }

  resetExpenseForm();
  elements.expenseSubject.focus();
  render();
});

elements.cancelExpenseEditButton.addEventListener("click", () => {
  resetExpenseForm();
  elements.expenseSubject.focus();
});

elements.deleteShareButton.addEventListener("click", () => {
  const share = activeShare();
  if (state.shares.length <= 1 || !confirm(`Delete "${share.name}"?`)) {
    return;
  }

  state.shares = state.shares.filter((item) => item.id !== share.id);
  state.activeShareId = state.shares[0].id;
  goHome();
});

function renderCurrencyOptions() {
  elements.currencySelect.replaceChildren();
  CURRENCY_OPTIONS.forEach((currency) => {
    const option = document.createElement("option");
    option.value = currency.code;
    option.textContent = currency.label;
    elements.currencySelect.append(option);
  });
}

elements.currencySelect.addEventListener("change", () => {
  const share = activeShare();
  share.currency = elements.currencySelect.value;
  render();
});

elements.exportButton.addEventListener("click", async () => {
  const share = activeShare();
  const result = calculate(share);
  const currency = shareCurrency(share);
  const lines = [
    `${share.emoji || "💸"} ${share.name}`,
    `Currency: ${currency}`,
    `Total: ${money(result.total, currency)}`,
    "Shares are calculated from each row's selected contributors and percentage weights.",
    "",
    "Balances",
    ...result.balances.map((balance) => `${balance.name}: paid ${money(balance.paid, currency)}, share ${money(balance.owed, currency)}, balance ${money(balance.balance, currency)}`),
    "",
    "Payments",
    ...(result.settlements.length
      ? result.settlements.map((payment) => `${payment.from} pays ${payment.to} ${money(payment.amount, currency)}`)
      : ["All settled"]),
  ];

  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    elements.exportButton.textContent = "Copied";
  } catch {
    elements.exportButton.textContent = "Failed";
  }
  setTimeout(() => {
    elements.exportButton.textContent = "Export";
  }, 1200);
});

elements.syncUrl.value = savedSyncUrl();
if (elements.syncUrl.value) {
  setSyncStatus("Connected to Google Drive", "success");
}

renderEmojiPicker(elements.emojiPicker, elements.emojiPickerButton, elements.shareEmoji);
renderEmojiPicker(elements.activeShareEmojiPicker, elements.activeShareEmojiButton, elements.activeShareEmoji, () => {
  const share = activeShare();
  share.emoji = elements.activeShareEmoji.value || "💸";
  render();
});
renderCurrencyOptions();
window.addEventListener("hashchange", () => {
  const route = currentRoute();
  if (route.page === "share") {
    const requestedShare = state.shares.find((share) => share.id === route.shareId);
    if (requestedShare) {
      state.activeShareId = requestedShare.id;
    }
  }
  render();
});
if (!window.location.hash) {
  window.location.hash = "#home";
}
render();
