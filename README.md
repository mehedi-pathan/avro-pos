# Avro POS

> Local-first desktop Point of Sale system built with Next.js, Electron, Prisma, and SQLite.

Secure, privacy-first retail operations that work fully offline with optional Google Drive sync. Designed for small to medium businesses with role-based team management.

![Tech Stack](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite)
![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss)

---

## Features

- **Point of Sale** — Fast product search, SKU scanning, cart management, discount & tax calculation
- **Inventory Management** — CRUD operations, low-stock alerts, barcode generation
- **Sales History** — Complete sale records with receipt printing (A4 & POS thermal)
- **Team Management** — Role-based access (Owner, Manager, Salesman), staff provisioning
- **Customer Management** — Loyalty points tracking, purchase history
- **Business Settings** — Customizable business info, currency, tax configuration
- **Google Drive Sync** — Optional cloud backup for your data
- **Local Backup** — One-click export to disk (JSON + SQLite)
- **Audit Logging** — Full activity trail for compliance
- **Fully Offline** — No internet required for daily operations

## Tech Stack

| Layer       | Technology                                      |
| ----------- | ----------------------------------------------- |
| Frontend    | Next.js 15, React 19, Tailwind CSS 3, Zustand   |
| Desktop     | Electron 33                                     |
| Backend     | Electron IPC (main process)                     |
| Database    | SQLite via Prisma 5 ORM                         |
| Auth        | bcryptjs password hashing                       |
| Cloud       | Google Drive API (optional)                     |

## Project Structure

```
avro-pos/
├── main/                        # Electron main process
│   ├── main.ts                  # App entry, window, IPC handlers
│   ├── preload.ts               # Context bridge (exposes window.api)
│   └── services/
│       ├── auth.ts              # Login logic
│       ├── bootstrap.ts         # Schema initialization
│       ├── capabilities.ts      # Role/capability definitions
│       ├── crm.ts               # Customer management
│       ├── database.ts          # Prisma client
│       ├── iam.ts               # User/role management
│       ├── inventoryIntelligence.ts
│       ├── localBackup.ts       # Disk backup service
│       ├── gdrive.ts            # Google Drive sync
│       ├── pos.ts               # Products & sales engine
│       ├── printer.ts           # Thermal receipt formatter
│       ├── settings.ts          # Business settings
│       └── status.ts            # Heartbeat / health check
├── renderer/                    # Next.js frontend
│   ├── app/
│   │   ├── layout.tsx           # Root layout (AuthProvider)
│   │   ├── page.tsx             # Login + Dashboard
│   │   ├── globals.css          # Global styles + animations
│   │   ├── checkout/page.tsx    # POS checkout
│   │   ├── inventory/page.tsx   # Product management
│   │   ├── sales-history/page.tsx # Sale records & printing
│   │   ├── settings/page.tsx    # Business & profile settings
│   │   └── staff/page.tsx       # Team management
│   ├── components/
│   │   ├── AppShell.tsx         # Authenticated layout shell
│   │   └── Money.tsx            # Currency formatting
│   ├── hooks/
│   │   └── useAuth.tsx          # Auth context & provider
│   ├── lib/
│   │   ├── api.ts               # Electron IPC API wrapper
│   │   └── types.ts             # TypeScript types
│   └── store/
│       └── useCart.ts           # Zustand cart store (persisted)
├── prisma/
│   └── schema.prisma            # Database schema
├── tailwind.config.ts           # Tailwind theme config
├── tsconfig.json                # Next.js TypeScript config
├── tsconfig.electron.json       # Electron TypeScript config
└── electron-builder.yml         # Distribution packaging
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Installation

```bash
git clone <repository-url>
cd avro-pos
npm install
```

### Database Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Push schema to SQLite (creates database)
npm run prisma:push
```

### Development

The dev command starts both the Next.js renderer and Electron window:

```bash
npm run dev
```

This runs:
1. Next.js dev server on `http://localhost:3000`
2. Electron window that loads the Next.js app

### Building for Production

```bash
# Build the application
npm run build

# Package for distribution (macOS .dmg / Windows .exe)
npm run dist
```

## Role-Based Access Control

| Capability        | Salesman | Manager | Owner |
| ----------------- | -------- | ------- | ----- |
| Checkout          | ✓        | ✓       | ✓     |
| Inventory Read    |          | ✓       | ✓     |
| Inventory Write   |          | ✓       | ✓     |
| Sales History     |          | ✓       | ✓     |
| Team Management   |          |         | ✓     |
| Delete Records    |          |         | ✓     |
| Cloud Sync        |          |         | ✓     |
| Settings          |          |         | ✓     |

## Default Owner Account

After initial setup, create an Owner account by running:

```bash
npx tsx main/services/bootstrap.ts
```

Or use the built-in seed if available. The database schema auto-initializes on first launch.

## Printing

- **A4 Receipt** — Opens a print dialog with a formatted A4 receipt
- **POS Thermal Receipt** — Generates a 58mm thermal receipt format for POS printers

## Backup

- **Local Backup** — Saves JSON and SQLite copies to disk via the dashboard
- **Google Drive Sync** — Configured in Settings, requires a Google Drive folder ID

## Development

```bash
# Type checking
npx tsc -p tsconfig.electron.json --noEmit
npx next build renderer --no-lint

# Linting
npm run lint

# Prisma migration
npm run prisma:migrate
```

## Next Version Roadmap

1. **Dashboard Analytics** — Daily/weekly/monthly sales charts, revenue graphs, top-selling products
2. **Supplier Management** — Vendor profiles, purchase orders, stock receiving
3. **Offline Sync Engine** — Conflict resolution when Drive sync reconnects after offline
4. **Barcode Scanner** — Native USB scanner support via Electron (instead of keyboard SKU field)
5. **Return/Refund Flow** — Process returns, refund to original sale, restock items
6. **Email Receipts** — Auto-send or on-demand email receipts (default: no send)
7. **Multi-Store Support** — Branch-level inventory separation with consolidated reporting
8. **Database Backup Scheduling** — Auto-backup at configurable intervals to local disk or Drive
9. **Bulk Product Import** — CSV template upload for batch product creation
10. **Full Theme Support** — Complete dark/light mode across all components

## Built With

- [Next.js](https://nextjs.org/) — React framework
- [Electron](https://www.electronjs.org/) — Desktop shell
- [Prisma](https://www.prisma.io/) — ORM
- [SQLite](https://www.sqlite.org/) — Embedded database
- [Tailwind CSS](https://tailwindcss.com/) — Styling
- [Zustand](https://github.com/pmndrs/zustand) — State management
- [bcryptjs](https://github.com/dcodeIO/bcrypt.js) — Password hashing
- [Google APIs](https://github.com/googleapis/googleapis) — Drive sync

---

**Developer:** [Mehedi Pathan](https://mehedipathan.online)
