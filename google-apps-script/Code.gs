const SHEET_NAME = "Share Split Database";
const DATA_CELL = "A1";
const UPDATED_CELL = "B1";

function doGet(event) {
  const action = event.parameter.action || "load";

  if (action !== "load") {
    return jsonResponse({ ok: false, error: "Unsupported action." }, event);
  }

  const sheet = databaseSheet();
  const stored = sheet.getRange(DATA_CELL).getValue();
  const data = stored ? JSON.parse(stored) : null;

  return jsonResponse({ ok: true, data }, event);
}

function doPost(event) {
  const action = event.parameter.action || "save";

  if (action !== "save") {
    return jsonResponse({ ok: false, error: "Unsupported action." }, event);
  }

  const data = event.parameter.data || (event.postData && event.postData.contents);
  if (!data) {
    return jsonResponse({ ok: false, error: "No data was received." }, event);
  }

  const parsed = JSON.parse(data);

  if (!isValidState(parsed)) {
    return jsonResponse({ ok: false, error: "Invalid share split data." }, event);
  }

  const sheet = databaseSheet();
  sheet.getRange(DATA_CELL).setValue(JSON.stringify(parsed));
  sheet.getRange(UPDATED_CELL).setValue(new Date());

  return jsonResponse({ ok: true, updatedAt: new Date().toISOString() }, event);
}

function databaseSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    sheet.getRange("A1:B1").setValues([["", "Updated at"]]);
  }

  return sheet;
}

function isValidState(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof value.activeShareId === "string" &&
      Array.isArray(value.shares) &&
      value.shares.every(function (share) {
        return typeof share.id === "string" && typeof share.name === "string" && Array.isArray(share.people) && Array.isArray(share.expenses);
      })
  );
}

function jsonResponse(payload, event) {
  const callback = event && event.parameter && event.parameter.callback;
  const body = JSON.stringify(payload);

  if (callback) {
    return ContentService.createTextOutput(callback + "(" + body + ");").setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}
