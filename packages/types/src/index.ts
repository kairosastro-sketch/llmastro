// ============================================================
// ASTRO PLATFORM — Shared Types
// ============================================================

// ----------------------------------------------------------
// User & Auth
// ----------------------------------------------------------
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  provider: OAuthProvider | "local";
  providerId: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type OAuthProvider = "google" | "github";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JWTPayload {
  sub: string;       // user id
  email: string;
  iat: number;
  exp: number;
  type: "access" | "refresh";
}

// ----------------------------------------------------------
// Natal Data
// ----------------------------------------------------------
export interface NatalData {
  id: string;
  userId: string;
  label: string;         // "Moi", "Maman", etc.
  birthDate: string;     // ISO 8601 date: YYYY-MM-DD
  birthTime: string;     // HH:MM (local time)
  birthTimeUnknown: boolean;
  latitude: number;
  longitude: number;
  timezone: string;      // IANA tz: "Europe/Paris"
  birthCity: string;
  birthCountry: string;
  // RELATIONSHIPS-V1 — tag de la relation utilisateur↔profil. Voir relationships.ts.
  relationshipCategory?: string;   // RelationshipCategory ("romantic" | "family" | …)
  relationshipType?: string;       // sous-type ("colleague" | "parent" | …)
  createdAt: Date;
  updatedAt: Date;
}

export type NatalDataCreate = Omit<NatalData, "id" | "userId" | "createdAt" | "updatedAt">;
export type NatalDataUpdate = Partial<NatalDataCreate>;

// ----------------------------------------------------------
// Ephemeris
// ----------------------------------------------------------
export type ZodiacSign =
  | "Aries" | "Taurus" | "Gemini" | "Cancer"
  | "Leo" | "Virgo" | "Libra" | "Scorpio"
  | "Sagittarius" | "Capricorn" | "Aquarius" | "Pisces";

export type Planet =
  | "Sun" | "Moon" | "Mercury" | "Venus" | "Mars"
  | "Jupiter" | "Saturn" | "Uranus" | "Neptune" | "Pluto"
  | "NorthNode" | "Chiron" | "Lilith"
  // ASTEROIDS-V1 : corps secondaires (calculés via swisseph mode fichier).
  | "Ceres" | "Pallas" | "Juno" | "Vesta" | "LilithTrue";

export type HouseSystem = "P" | "K" | "W" | "E" | "O" | "R";

export interface PlanetPosition {
  planet: Planet;
  longitude: number;       // 0–360°
  latitude: number;
  speed: number;           // deg/day (negative = retrograde)
  retrograde: boolean;
  sign: ZodiacSign;
  signDegree: number;      // 0–30 within sign
  house: number;           // 1–12
}

export interface HouseCusp {
  house: number;           // 1–12
  longitude: number;       // 0–360°
  sign: ZodiacSign;
  signDegree: number;
}

export interface Angle {
  name: "ASC" | "MC" | "DSC" | "IC";
  longitude: number;
  sign: ZodiacSign;
  signDegree: number;
}

export interface Aspect {
  planet1: Planet;
  planet2: Planet;
  type: AspectType;
  orb: number;             // degrees of orb
  exact: number;           // exact longitude difference
  applying: boolean;       // applying (true) or separating (false)
}

export type AspectType =
  | "conjunction"    // 0°
  | "sextile"        // 60°
  | "square"         // 90°
  | "trine"          // 120°
  | "opposition"     // 180°
  | "quincunx"       // 150°
  | "semisextile"    // 30°
  | "semisquare"     // 45°
  | "sesquiquadrate" // 135°
  | "quintile"       // 72°
  | "biquintile";    // 144°

export interface NatalChart {
  natalDataId: string;
  calculatedAt: Date;
  houseSystem: HouseSystem;
  planets: PlanetPosition[];
  houses: HouseCusp[];
  angles: Angle[];
  aspects: Aspect[];
}

// ----------------------------------------------------------
// API Response Wrappers
// ----------------------------------------------------------
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ----------------------------------------------------------
// Pagination
// ----------------------------------------------------------
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ARCHIVE-3-TIERS-V1
export * from "./tiers.js";
export * from "./relationships.js";

// NOTIFICATIONS-V1
export * from "./notifications.js";
