# keyjump: Keyword Jump Finder

A simple Chrome extension that helps you find, highlight, and jump to important keywords on any webpage.
  
You can enter and save a list of keywords, scan the current page, highlight matching text, and quickly jump through found matches.

It is useful when you want to quickly scan long webpages for important terms without manually using the browser search box over and over.

## Use Cases

This extension is especially useful for job searching. For example, when reading job postings, you can search for keywords such as:

- visa / sponsorship
- years of experience
- required skills

at the same time, easier than using ctrl + F.

This helps you quickly identify whether a job posting mentions important eligibility, sponsorship, or experience-related terms.

It can also be useful for reading:

- policy pages
- documentation
- long articles
- product listings
- school or government pages
- any webpage where you need to find specific terms quickly

## Features

- Floating keyword finder widget on webpages
- Draggable panel
- Foldable settings section
- Editable keyword list
- Saves your keywords and settings
- Case-sensitive search option
- Whole-word-only search option
- Auto Scan on Page Load option
- Highlights matched keywords on the page
- Shows how many matches were found
- `Go to` button for jumping through matches
- Click the extension icon to show or hide the widget on the current tab
- Colored toolbar icon when the widget is on
- Gray toolbar icon when the widget is off
- Close button to hide the widget for the current page session
- Preserves saved keywords and settings when the widget is hidden

## Installation

This extension is currently installed manually as an unpacked Chrome extension.

1. Download or clone this project to your computer.

2. Open Google Chrome.

3. Go to:

   ```text
   chrome://extensions
   ```

4. Turn on **Developer mode**.

   You can usually find this switch in the top-right corner of the Extensions page.

5. Click **Load unpacked**.

6. Select the project folder `keyjump`.

7. The extension should now appear in your Chrome extensions list.

8. Optional: pin the extension to your Chrome toolbar.

## How to Use

1. Open any normal webpage.

2. The floating **keyjump** widget should appear automatically.

3. Open the **Settings** section if it is folded.

4. Enter your keywords in the text box.

   Use one keyword per line.

5. Choose any search options you want:

   - **Case sensitive**
   - **Whole word only**
   - **Auto Scan on Page Load**

6. Click **Save & Scan**.

7. Review the matched keywords in the results area.

8. Click **Go to** next to a keyword to jump to a match on the page.

9. Click **Go to** repeatedly to move through multiple matches for the same keyword.

10. Click the extension icon in the Chrome toolbar to hide the widget on the current tab.

    The toolbar icon turns gray, the widget is removed from the page, and any keyword highlights are cleared.

11. Click the extension icon again to show the widget again.

    The toolbar icon turns colored again, your last saved keywords and settings are reloaded, and auto scan runs if it is enabled.

12. You can also click the close button on the widget to hide it for the current page session.

## Toolbar Icon Toggle

The Chrome toolbar icon acts as an on/off switch for the widget on the current tab:

- **Colored icon** means the widget is enabled and visible.
- **Gray icon** means the widget is disabled and hidden.
- Turning the widget off does not erase saved keywords or settings.
- Turning the widget back on restores the widget from `chrome.storage.local`.
- The page is not refreshed when toggling the widget.
- No popup or options page opens when clicking the icon.

The toggle is per tab and per page session. After a real page reload or navigating to a new page, the widget starts enabled again.

## Tips

- Keep one keyword per line for best results.
- Use **Whole word only** to reduce false matches.
- Use **Auto Scan on Page Load** if you often search for the same keywords across many pages.
- Click **Go to** repeatedly to cycle through multiple matches for the same keyword.
- Use the toolbar icon when you temporarily want the page back to normal without losing your saved search setup.
- For job searching, save a reusable list of terms you care about, such as visa, sponsorship, OPT, CPT, H1B, and years of experience.

## Notes / Limitations

- Some browser pages may not be scanned.
- Behavior may vary on highly dynamic webpages that constantly update their content.
- The toolbar toggle is temporary for the current tab/page session and does not change saved search settings.
- If you change extension files locally, reload the extension from `chrome://extensions`.

## Feedback

If something feels off or you have ideas to improve it, please feel free to open an issue.
