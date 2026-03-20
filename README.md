# GIGA Dashboard - Prevaler

## Directorio Médico - Sistema GIGA v3.0

A modern, responsive medical directory dashboard built with Next.js and Supabase.

### Features

- **Modern Medical Interface**: Clean, professional design with medical blue theme
- **7 Medical Locations**: Complete directory for all Prevaler locations
- **Real-time Search**: Search by doctor name, specialty, or location
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Live Database**: Connected to Supabase for real-time data
- **Spanish UI**: Complete Spanish interface

### Technology Stack

- **Frontend**: Next.js 14 with App Router
- **Styling**: Custom CSS with medical theme
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel
- **Language**: TypeScript

### Medical Locations

- SEDE NORTE
- SEDE SUR  
- SEDE ESTE
- SEDE VIÑA
- SEDE PUERTO CABELLO
- SEDE MARACAY
- SEDE PORLAMAR

### Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Project Structure

```
├── app/
│   ├── lib/
│   │   └── supabase.ts       # Supabase client and queries
│   ├── components/
│   ├── sede/[sede]/
│   │   └── page.tsx          # Individual location pages  
│   ├── globals.css           # Medical theme styles
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Main dashboard
├── package.json
└── README.md
```

### Deployment

The application is optimized for Vercel deployment with automatic builds and deployments.

---

**Sistema GIGA v3.0** — Directorio médico conectado a base de datos en tiempo real