import type { Unit } from "./units";

export type FitMode = "contain" | "cover";

export type Preset = {
  id: string;
  label: string;
  note: string;
  group: string;
  width: number;
  height: number;
  unit: Unit;
  dpi: number;
  /** CSS colour, or "transparent". */
  background: string;
  fit: FitMode;
  /** Breathing room around the subject, as a fraction of the shorter side. */
  padding: number;
};

export const PRESET_GROUPS = ["Документы", "Соцсети", "Торговля"] as const;

export const PRESETS: Preset[] = [
  {
    id: "uz-3x4",
    label: "3 × 4 см",
    note: "Стандарт для документов",
    group: "Документы",
    width: 30,
    height: 40,
    unit: "mm",
    dpi: 300,
    background: "#ffffff",
    fit: "contain",
    padding: 0.08,
  },
  {
    id: "passport-35x45",
    label: "3,5 × 4,5 см",
    note: "Паспорт, шенгенская виза",
    group: "Документы",
    width: 35,
    height: 45,
    unit: "mm",
    dpi: 300,
    background: "#ffffff",
    fit: "contain",
    padding: 0.08,
  },
  {
    id: "us-visa",
    label: "2 × 2 дюйма",
    note: "Виза США и DV-лотерея",
    group: "Документы",
    width: 2,
    height: 2,
    unit: "in",
    dpi: 300,
    background: "#ffffff",
    fit: "contain",
    padding: 0.1,
  },
  {
    id: "cv",
    label: "600 × 800 px",
    note: "Фото для резюме",
    group: "Документы",
    width: 600,
    height: 800,
    unit: "px",
    dpi: 72,
    background: "#ffffff",
    fit: "contain",
    padding: 0.08,
  },
  {
    id: "ig-post",
    label: "1080 × 1080 px",
    note: "Пост в Instagram",
    group: "Соцсети",
    width: 1080,
    height: 1080,
    unit: "px",
    dpi: 72,
    background: "transparent",
    fit: "contain",
    padding: 0.12,
  },
  {
    id: "ig-story",
    label: "1080 × 1920 px",
    note: "Сторис Instagram / Telegram",
    group: "Соцсети",
    width: 1080,
    height: 1920,
    unit: "px",
    dpi: 72,
    background: "transparent",
    fit: "contain",
    padding: 0.14,
  },
  {
    id: "tg-avatar",
    label: "512 × 512 px",
    note: "Аватар Telegram",
    group: "Соцсети",
    width: 512,
    height: 512,
    unit: "px",
    dpi: 72,
    background: "transparent",
    fit: "cover",
    padding: 0.06,
  },
  {
    id: "yt-thumb",
    label: "1280 × 720 px",
    note: "Обложка YouTube",
    group: "Соцсети",
    width: 1280,
    height: 720,
    unit: "px",
    dpi: 72,
    background: "transparent",
    fit: "contain",
    padding: 0.08,
  },
  {
    id: "shop-1000",
    label: "1000 × 1000 px",
    note: "Товар, прозрачный фон",
    group: "Торговля",
    width: 1000,
    height: 1000,
    unit: "px",
    dpi: 72,
    background: "transparent",
    fit: "contain",
    padding: 0.08,
  },
  {
    id: "shop-2000",
    label: "2000 × 2000 px",
    note: "Маркетплейс, белый фон",
    group: "Торговля",
    width: 2000,
    height: 2000,
    unit: "px",
    dpi: 72,
    background: "#ffffff",
    fit: "contain",
    padding: 0.06,
  },
];

export function findPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
