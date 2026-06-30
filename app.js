const STORAGE_KEY = "share-split:v1";
const EMOJI_OPTIONS = ["💸", "🍽️", "🏖️", "🏠", "🚕", "🎁", "🎉", "🧾", "☕", "🍕", "✈️", "🛒", "🎬", "🏕️", "⚽", "💡"];

const state = loadState();

const elements = {
  homeButton: document.querySelector("#homeButton"),
  newShareButton: document.querySelector("#newShareButton"),
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
  contributorsList: document.querySelector("#contributorsList"),
  expenseCount: document.querySelector("#expenseCount"),
  expenseTable: document.querySelector("#expenseTable"),
  totalAmount: document.querySelector("#totalAmount"),
  balanceList: document.querySelector("#balanceList"),
  settlementCount: document.querySelector("#settlementCount"),
  settlementList: document.querySelector("#settlementList"),
  emptyStateTemplate: document.querySelector("#emptyStateTemplate"),
};

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed.shares)) {
        return parsed;
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  const initialShare = {
    id: crypto.randomUUID(),
    name: "Dinner share",
    emoji: "🍽️",
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

function money(value) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
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

  const total = share.expenses.reduce((sum, expense) => sum + expense.amount, 0);

  share.expenses.forEach((expense) => {
    const payer = balances.get(expense.personId);
    const contributorIds = validContributorIds(share, expense);
    const owedPerContributor = contributorIds.length ? expense.amount / contributorIds.length : 0;

    if (payer) {
      payer.paid += expense.amount;
    }

    contributorIds.forEach((personId) => {
      const contributor = balances.get(personId);
      if (contributor) {
        contributor.owed += owedPerContributor;
      }
    });
  });

  balances.forEach((balance) => {
    balance.balance = roundMoney(balance.paid - balance.owed);
  });

  return {
    total,
    balances: [...balances.values()],
    settlements: settle([...balances.values()]),
  };
}

function validContributorIds(share, expense) {
  const peopleIds = new Set(share.people.map((person) => person.id));
  const storedIds = Array.isArray(expense.contributorIds) ? expense.contributorIds : share.people.map((person) => person.id);
  return storedIds.filter((personId) => peopleIds.has(personId));
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

  if (requestedShare) {
    state.activeShareId = requestedShare.id;
  }

  elements.expenseDate.value ||= today();
  renderShares(share);
  renderLanding();

  if (route.page === "share" && requestedShare) {
    elements.landingPage.hidden = true;
    elements.sharePage.hidden = false;
    renderHeader(share);
    renderPeople(share);
    renderExpenses(share);
    renderResults(share);
  } else {
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
        <span>${share.people.length} people · ${share.expenses.length} rows · ${money(result.total)} total</span>
      </span>
      <span class="open-arrow">→</span>
    `;
    card.addEventListener("click", () => goToShare(share.id));
    elements.landingShareList.append(card);
  });
}

function renderHeader(share) {
  elements.activeShareTitle.innerHTML = `<span class="share-icon">${escapeHtml(share.emoji || "💸")}</span><span>${escapeHtml(share.name)}</span>`;
  elements.deleteShareButton.disabled = state.shares.length <= 1;
}

function renderPeople(share) {
  elements.peopleCount.textContent = `${share.people.length} total`;
  elements.personList.replaceChildren();
  elements.expensePayer.replaceChildren();
  elements.contributorsList.replaceChildren();
  elements.expenseForm.querySelector("button").disabled = share.people.length === 0;

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

    const label = document.createElement("label");
    label.className = "contributor-option";
    label.innerHTML = `
      <input type="checkbox" name="contributors" value="${escapeHtml(person.id)}" checked />
      <span>${escapeHtml(person.name)}</span>
    `;
    elements.contributorsList.append(label);
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

  [...share.expenses]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((expense) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(expense.date)}</td>
        <td>${escapeHtml(expense.subject)}</td>
        <td>${escapeHtml(personName(share, expense.personId))}</td>
        <td>${escapeHtml(contributorNames(share, expense))}</td>
        <td class="number-cell">${money(expense.amount)}</td>
        <td class="number-cell">
          <button class="mini-button" type="button" title="Remove amount" aria-label="Remove amount">×</button>
        </td>
      `;
      row.querySelector("button").addEventListener("click", () => {
        share.expenses = share.expenses.filter((item) => item.id !== expense.id);
        render();
      });
      elements.expenseTable.append(row);
    });
}

function contributorNames(share, expense) {
  const ids = validContributorIds(share, expense);
  if (!ids.length) return "No contributors";
  if (ids.length === share.people.length) return "Everyone";
  return ids.map((personId) => personName(share, personId)).join(", ");
}

function renderResults(share) {
  const result = calculate(share);
  elements.totalAmount.textContent = `${money(result.total)} total`;
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
        <span class="balance-meta">Paid ${money(balance.paid)} · Share ${money(balance.owed)}</span>
      </div>
      <span class="balance-value ${status}">${label} ${money(Math.abs(balance.balance))}</span>
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
      <strong>${escapeHtml(payment.from)} pays ${escapeHtml(payment.to)} ${money(payment.amount)}</strong>
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

function renderEmojiPicker() {
  elements.emojiPicker.replaceChildren();
  EMOJI_OPTIONS.forEach((emoji) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "emoji-option";
    button.textContent = emoji;
    button.setAttribute("aria-label", `Use ${emoji}`);
    button.addEventListener("click", () => {
      elements.shareEmoji.value = emoji;
      elements.emojiPickerButton.textContent = emoji;
      elements.emojiPicker.hidden = true;
    });
    elements.emojiPicker.append(button);
  });
}

elements.emojiPickerButton.addEventListener("click", () => {
  elements.emojiPicker.hidden = !elements.emojiPicker.hidden;
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".emoji-picker-wrap")) {
    elements.emojiPicker.hidden = true;
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
  render();
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

  if (!share.people.length || !Number.isFinite(amount) || amount <= 0 || !contributorIds.length) {
    alert("Select at least one contributor for this amount.");
    return;
  }

  share.expenses.push({
    id: crypto.randomUUID(),
    date: elements.expenseDate.value || today(),
    subject: elements.expenseSubject.value.trim(),
    personId: elements.expensePayer.value,
    contributorIds,
    amount: roundMoney(amount),
  });

  elements.expenseSubject.value = "";
  elements.expenseAmount.value = "";
  elements.expenseSubject.focus();
  render();
});

elements.deleteShareButton.addEventListener("click", () => {
  const share = activeShare();
  if (state.shares.length <= 1 || !confirm(`Delete "${share.name}"?`)) {
    return;
  }

  state.shares = state.shares.filter((item) => item.id !== share.id);
  state.activeShareId = state.shares[0].id;
  render();
});

elements.exportButton.addEventListener("click", async () => {
  const share = activeShare();
  const result = calculate(share);
  const lines = [
    `${share.emoji || "💸"} ${share.name}`,
    `Total: ${money(result.total)}`,
    "Shares are calculated from each row's selected contributors.",
    "",
    "Balances",
    ...result.balances.map((balance) => `${balance.name}: paid ${money(balance.paid)}, share ${money(balance.owed)}, balance ${money(balance.balance)}`),
    "",
    "Payments",
    ...(result.settlements.length
      ? result.settlements.map((payment) => `${payment.from} pays ${payment.to} ${money(payment.amount)}`)
      : ["All settled"]),
  ];

  await navigator.clipboard.writeText(lines.join("\n"));
  elements.exportButton.textContent = "Copied";
  setTimeout(() => {
    elements.exportButton.textContent = "Export";
  }, 1200);
});

renderEmojiPicker();
window.addEventListener("hashchange", render);
if (!window.location.hash) {
  window.location.hash = "#home";
}
render();
