# AquaVision Frontend 🌊

The official web user interface for the **AquaVision** Underwater Image Enhancement system, built with **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS**, and **Lucide Icons**.

---

## ✨ Features

- **Split Comparison Slider**: Smooth, responsive before/after image comparison with touch and mouse drag support.
- **Drag-and-Drop Uploader**: Direct file uploading with instant preview and preset sample selectors.
- **Live Quality Metrics**: Real-time display of execution time, estimated PSNR, UIQM, and UCIQE metrics.
- **History Gallery**: Seamless session history tracking with quick-reload capabilities.
- **Technical Synopsis Modal**: Interactive modal outlining the deep learning architecture, optical degradation principles, and benchmark results.
- **Glassmorphism Design**: Modern, ocean-inspired dark UI with animated gradients and glow effects.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18.17.0 or higher
- **npm** or **yarn** / **pnpm** / **bun**

### 2. Installation

```bash
# Navigate to the frontend folder
cd frontend

# Install package dependencies
npm install
```

### 3. Configure Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Default contents of `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛠️ Build & Production

To create an optimized production build:

```bash
npm run build
npm run start
```

---

## 📁 Directory Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout with metadata and fonts
│   │   ├── page.tsx               # Main application container
│   │   └── globals.css            # Custom CSS utilities & design tokens
│   ├── components/
│   │   ├── Navbar.tsx             # Top navigation & system status
│   │   ├── ImageUploader.tsx      # File upload & preset sample buttons
│   │   ├── ComparisonViewer.tsx   # Interactive split slider
│   │   ├── MetricsPanel.tsx       # Quality metrics & execution details
│   │   ├── HistorySection.tsx     # Recent enhancement history
│   │   ├── SynopsisModal.tsx      # Technical project modal
│   │   └── Footer.tsx             # Footer component
│   └── lib/
│       ├── api.ts                 # Backend API client
│       └── types.ts               # TypeScript data definitions
├── public/
│   └── samples/                   # Built-in underwater sample images
├── .env.example                   # Environment variable template
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
└── README.md                      # Frontend documentation
```
