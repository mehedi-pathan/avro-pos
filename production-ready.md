# production-ready

---

To generate your production-ready `.dmg` (macOS) and `.exe` (Windows) files from your Mac, you will use **Electron Builder** combined with **GitHub Actions**. Since a Mac cannot natively compile a Windows `.exe` that includes native modules like SQLite/Prisma correctly, the GitHub Actions workflow is the "secret sauce" that does the heavy lifting for you.

---

## 1. Configure `package.json` Scripts

First, ensure your main `package.json` has the correct scripts to trigger the build process.

JSON

`"scripts": {
  "dev": "concurrently \"npm run dev:next\" \"npm run dev:electron\"",
  "build:next": "next build && next export",
  "dist": "electron-builder",
  "ship": "electron-builder --mac --win -p always"
}`

---

## 2. Configure `electron-builder.yml`

This file tells the builder how to package the app. Place this in your root directory.

YAML

`appId: com.avro.pos
productName: Avro POS
directories:
  output: dist
  buildResources: build
files:
  - from: .
    filter:
      - package.json
      - /main/dist/**
      - /renderer/out/**
      - /prisma/pos.db
      - /node_modules/**

# Windows specific config
win:
  target: nsis
  icon: build/icon.ico
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  shortcutName: Avro POS

# Mac specific config
mac:
  target: dmg
  category: public.app-category.business
  icon: build/icon.icns

# Critical: This ensures Prisma engines are included
extraResources:
  - from: node_modules/.prisma/client
    to: server/prisma-client
  - from: prisma/schema.prisma
    to: schema.prisma`

---

## 3. The GitHub Actions Workflow (The "Build Machine")

Since you are on a Mac, you need a Windows runner to create the `.exe`. Create a file at `.github/workflows/build.yml`.

YAML

`name: Build/Release Avro POS

on:
  push:
    tags:
      - 'v*' # Triggers when you push a tag like v1.0.0

jobs:
  release:
    runs-on: ${{ matrix.os }}

    strategy:
      matrix:
        os: [macos-latest, windows-latest]

    steps:
      - name: Checkout Code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install Dependencies
        run: npm install

      - name: Generate Prisma Client
        run: npx prisma generate

      - name: Build Next.js Frontend
        run: npm run build:next

      - name: Compile & Package
        run: npm run dist
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }} # Needed to upload to GitHub Releases`

---

## 4. How to build and get your files

### For macOS (.dmg):

You can build this locally on your Mac anytime:

1. Run `npm run dist`.
2. Look in the `/dist` folder. You will find `Avro POS-1.0.0.dmg`.

### For Windows (.exe):

1. **Push your code** to GitHub.
2. **Create a Tag:** In your terminal, type:
    - `git tag v1.0.0`
    - `git push origin v1.0.0`
3. **Check GitHub:** Go to your repository's **"Actions"** tab. You will see the Windows runner starting up.
4. **Download:** Once finished, go to the **"Releases"** section of your GitHub repo. Your `.exe` and `.dmg` will be sitting there waiting for you.

---

## ⚠️ Critical "Bangladesh Version" Reminder

Before you build for your client, ensure:

- **Prisma Client:** Run `npx prisma generate` so the database schema is baked in.
- **Production DB:** Ensure `pos.db` is empty of test sales but contains the `Owner` account so the client can log in.
- **Icons:** Ensure you have an `icon.icns` (Mac) and `icon.ico` (Windows) in your `/build` folder, otherwise Electron will use the default "Atom" icon.

**One last tip:** Since you are using Google Drive Sync, double-check that your `CLIENT_ID` and `CLIENT_SECRET` are correctly set in your environment variables on GitHub so the production build can "talk" to Google.