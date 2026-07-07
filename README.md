# 🚀 Facebook Group & Page Poster (Playwright + GitHub Actions + n8n)

Automated, cost-free, and anti-detection-engineered system to post on Facebook Groups and Facebook Pages using browser automation. Powered by **Playwright (Node.js)**, hosted on **GitHub Actions** (acting as a free serverless microservice), and triggered via **n8n**.

---

## 🗺️ Architecture Overview

```
[Chrome Extension] ──(Captures fresh cookies)──> [n8n Workflow]
                                                      │
                                           (HTTP POST Request)
                                                      │
                                                      ▼
                                              [GitHub Actions]
                                            (Runs headless Chrome)
                                                      │
                                                      ▼
                                                [Facebook]
```

---

## 📦 Project Directory Structure

```
facebook-group-poster/
├── .github/
│   └── workflows/
│       └── post.yml         # GitHub Actions runner configuration
├── index.js                 # Playwright automation engine (Anti-detection & Auto-Selectors)
├── package.json             # Node dependencies (Playwright, dotenv)
└── .gitignore               # Excludes node_modules & temporary debug screenshots
```

---

## 🛠️ GitHub Deployment Commands (Manual Push)

Run these commands in your project directory to push the files to your repository:

```bash
# 1. Initialize git (if not already done)
git init

# 2. Add files
git add .github/ package.json index.js .gitignore README.md

# 3. Create initial commit
git commit -m "feat: initial commit of facebook group poster"

# 4. Set branch to main and add remote repository
git branch -M main
git remote add origin https://github.com/expher510/facebook-group-poster.git

# 5. Push to GitHub (Force push if replacing old branch)
git push -u origin main --force
```

---

## 🍪 Step 1: Exporting Facebook Session Cookies

Facebook cookies give full access to your account. This system runs completely on session cookies, bypassing the username/password login wall entirely.

1. Install the browser extension **"Cookie-Editor"** (Chrome/Firefox/Brave).
2. Open [Facebook.com](https://www.facebook.com) and log in.
3. Click the extension icon → click **Export** → **Export as JSON**.
4. Save this JSON array. It will be passed dynamically from n8n or stored in GitHub Secrets.

---

## 🔗 Step 2: Configuring GitHub Personal Access Token (PAT)

n8n needs permission to trigger GitHub Actions.

1. Go to **GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
2. Click **Generate new token**.
3. Under **Repository access**, select **Only select repositories** → choose `facebook-group-poster`.
4. Under **Permissions** → **Repository permissions**:
   - `Actions` ──> **Read and write** (Allows triggering the workflow)
   - `Contents` ──> **Read-only**
5. Generate the token and copy it.

---

## ⚙️ Step 3: Setting Up n8n HTTP Request Node

Configure your HTTP Request node in n8n as follows:

- **Method:** `POST`
- **URL:** `https://api.github.com/repos/expher510/facebook-group-poster/dispatches`
- **Authentication:** `Header Auth`
  - **Name:** `Authorization`
  - **Value:** `Bearer ghp_YOUR_PERSONAL_ACCESS_TOKEN`

### Headers
| Header | Value |
|---|---|
| `Accept` | `application/vnd.github+json` |
| `X-GitHub-Api-Version` | `2022-11-28` |
| `Content-Type` | `application/json` |

### Body Parameters (JSON)
Select **JSON** as the body format and use this structure:

```json
{
  "event_type": "facebook_post",
  "client_payload": {
    "group_url": "https://www.facebook.com/EgAutonomous/",
    "post_content": "Your post text goes here 🚀",
    "fb_cookies": "YOUR_COOKIES_JSON_STRING_OR_EXPRESSION"
  }
}
```

> [!TIP]
> In n8n, pass the cookies dynamically from your extension node using:  
> `{{ JSON.stringify($json.playwright_cookies) }}`  
> This ensures cookies never expire since they are pulled fresh from your browser!

---

## 🛡️ Anti-Detection Mechanisms

This project implements advanced browser spoofing to bypass Facebook security on Cloud/Datacenter IPs (GitHub Actions):
* **Stealth Initialization:** Overrides `navigator.webdriver` to `undefined`, injects mock plugins, and customizes browser languages.
* **Randomized User-Agents:** Automatically picks a user-agent from a pool of modern desktop Chrome/Firefox configurations.
* **Human-like typing:** Types post content character-by-character with random delays between 50ms and 130ms, including realistic micro-pauses.
* **Mouse Jitter & Random Scrolling:** Moves the mouse cursor dynamically and scrolls the viewport randomly to mimic natural browsing patterns.
* **Random Action Intervals:** Inserts random delays (3 to 7 seconds) between loading, clicking, and typing.

---

## ❓ Frequently Asked Questions (FAQ)

### 1. Does the script support images or videos?
**No, this version is designed for text-only posts.**  
*To support media posting in the future:* We would need to pass image/video URLs in the JSON payload, download them inside the runner workspace, click the file input trigger (`input[type="file"]`), and upload the files.

### 2. Can I use this for both Groups and Pages?
**Yes.** The script automatically detects the interface layout:
* **For Pages:** It handles the two-step composer workflow (Clicking "Next/التالي" then clicking "Post/نشر").
* **For Groups:** It handles the single-step composer workflow (Clicking "Post/نشر" directly).
It supports both English and Arabic Facebook languages.

### 3. How do I debug failures?
If a post fails, the GitHub Action workflow will fail. A full-page screenshot of the error screen (`debug-error.png`) is automatically captured and uploaded to the **Actions Tab** as a downloadable artifact.
