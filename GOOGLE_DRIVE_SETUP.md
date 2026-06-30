# Google Drive Database Setup

This app can sync its data to a Google Sheet in your Google Drive. The app still works with local browser storage if you do not connect Drive.

## 1. Create the database sheet

1. Open [Google Sheets](https://sheets.new) and create a new spreadsheet.
2. Name it `Ashkan Share Split Database`.
3. Go to `Extensions` > `Apps Script`.
4. Delete the starter code.
5. Paste the code from `google-apps-script/Code.gs`.
6. Click `Save`.

## 2. Deploy the Apps Script

1. In Apps Script, click `Deploy` > `New deployment`.
2. Choose type `Web app`.
3. Set `Execute as` to `Me`.
4. Set `Who has access` to `Anyone with the link`.
5. Click `Deploy`.
6. Allow the Google permissions.
7. Copy the Web App URL.

## 3. Connect the app

1. Open the Share Split app.
2. Paste the Web App URL into `Google Drive sync`.
3. Click `Connect`.
4. Click `Save` to upload your current app data to Google Drive.
5. Use `Load` on another browser or device to restore the latest saved data.

## 4. Confirm it saved

After clicking `Save`, go back to your Google Sheet. You should see a tab named `Share Split Database`.

- Cell `A1` contains the app database as JSON text.
- Cell `B1` contains the last saved date and time.

If the `Share Split Database` tab is hidden from an older version of the script, click the sheet menu at the bottom left, choose `View all sheets`, and unhide it.

## Important

The Web App URL works like a private sync key. Do not publish it in the repository or share it with people who should not edit your app data.
