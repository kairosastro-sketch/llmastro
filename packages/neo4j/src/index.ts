import neo4j, { Driver, Session } from "neo4j-driver";
import type { NatalChart, Planet, ZodiacSign } from "@astro-platform/types";

export class Neo4jService {
  private driver: Driver;

  constructor() {
    const uri      = process.env["NEO4J_URI"]      ?? "bolt://localhost:7687";
    const user     = process.env["NEO4J_USER"]     ?? "neo4j";
    const password = process.env["NEO4J_PASSWORD"] ?? "password";

    this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxConnectionPoolSize: 50,
    });
  }

  async verifyConnectivity(): Promise<void> {
    await this.driver.verifyConnectivity();
  }

  session(): Session { return this.driver.session(); }

  async close(): Promise<void> { await this.driver.close(); }

  async initSchema(): Promise<void> {
    const session = this.session();
    try {
      const stmts = [
        "CREATE CONSTRAINT planet_name IF NOT EXISTS FOR (p:Planet) REQUIRE p.name IS UNIQUE",
        "CREATE CONSTRAINT sign_name IF NOT EXISTS FOR (s:Sign) REQUIRE s.name IS UNIQUE",
        "CREATE CONSTRAINT chart_id IF NOT EXISTS FOR (c:Chart) REQUIRE c.id IS UNIQUE",
        "CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE",
        "CREATE INDEX chart_userId IF NOT EXISTS FOR (c:Chart) ON (c.userId)",
      ];
      for (const stmt of stmts) { await session.run(stmt); }
      console.log("✅ Neo4j schema initialised");
    } finally { await session.close(); }
  }

  async seedReferenceData(): Promise<void> {
    const session = this.session();
    try {
      await session.run(`
        UNWIND $planets AS p
        MERGE (n:Planet { name: p.name })
        SET n.symbol = p.symbol, n.glyph = p.glyph
      `, { planets: PLANET_REFERENCE });

      await session.run(`
        UNWIND $signs AS s
        MERGE (n:Sign { name: s.name })
        SET n.element = s.element, n.modality = s.modality, n.ruler = s.ruler, n.degrees = s.degrees
      `, { signs: SIGN_REFERENCE });

      console.log("✅ Neo4j reference data seeded");
    } finally { await session.close(); }
  }

  async storeNatalChart(chartId: string, userId: string, chart: NatalChart): Promise<void> {
    const session = this.session();
    try {
      await session.executeWrite(async (tx) => {
        await tx.run(`
          MERGE (c:Chart { id: $chartId })
          SET c.userId = $userId, c.calculatedAt = $calculatedAt, c.houseSystem = $houseSystem
          WITH c MERGE (u:User { id: $userId }) MERGE (u)-[:HAS_CHART]->(c)
        `, { chartId, userId, calculatedAt: (chart.calculatedAt ?? new Date()).toISOString() /* STAB-PRE-5-V1 */, houseSystem: chart.houseSystem });

        // STAB-PRE-5-V1-B4 : EnrichedChart.planets est un Record, pas un tableau
        const planetsArr: any[] = Array.isArray(chart.planets)
          ? (chart.planets as any[])
          : Object.values(chart.planets as Record<string, any>);
        const SIGN_NAMES_EN = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
        for (const planet of planetsArr) {
          const planetName = planet.key ?? planet.planet ?? planet.name ?? "unknown";
          const signName   = planet.sign ?? (typeof planet.signIdx === "number" ? SIGN_NAMES_EN[planet.signIdx] : "unknown");
          const signDeg    = planet.signDegree ?? planet.degree ?? 0;
          await tx.run(`
            MATCH (c:Chart { id: $chartId })
            MERGE (p:Placement { chartId: $chartId, planet: $planet })
            SET p.longitude = $longitude, p.signDegree = $signDegree,
                p.house = $house, p.retrograde = $retrograde, p.speed = $speed,
                p.sign = $sign
            MERGE (c)-[:HAS_PLACEMENT]->(p)
          `, {
            chartId,
            planet:     planetName,
            sign:       signName,
            longitude:  planet.longitude ?? 0,
            signDegree: signDeg,
            house:      planet.house ?? 0,
            retrograde: planet.retrograde ?? false,
            speed:      planet.speed ?? 0
          });
        }
      });
    } finally { await session.close(); }
  }

  async getNatalChart(chartId: string): Promise<NatalChart | null> {
    const session = this.session();
    try {
      const result = await session.run(`
        MATCH (c:Chart { id: $chartId })-[:HAS_PLACEMENT]->(p:Placement)
        RETURN c, collect(p) as placements
      `, { chartId });
      if (result.records.length === 0) return null;
      const c = result.records[0]!.get("c").properties;
      const placements = result.records[0]!.get("placements") as Array<{ properties: Record<string, unknown> }>;
      return {
        natalDataId: c.id as string,
        calculatedAt: new Date(c.calculatedAt as string),
        houseSystem: c.houseSystem as "P",
        planets: placements.map(p => p.properties as unknown as import("@astro-platform/types").PlanetPosition),
        houses: [], angles: [], aspects: [],
      };
    } finally { await session.close(); }
  }

  async findSunSignCommunity(sign: ZodiacSign): Promise<string[]> {
    const session = this.session();
    try {
      const result = await session.run(`
        MATCH (u:User)-[:HAS_CHART]->(c:Chart)-[:HAS_PLACEMENT]->(p:Placement { planet: 'Sun', sign: $sign })
        RETURN u.id as userId
      `, { sign });
      return result.records.map(r => r.get("userId") as string);
    } finally { await session.close(); }
  }

  async findChartsWithAspect(planet1: Planet, planet2: Planet, aspectType: string, maxOrb = 3): Promise<string[]> {
    const session = this.session();
    try {
      const result = await session.run(`
        MATCH (p1:Placement { planet: $planet1 })-[a:ASPECT { type: $type }]->(p2:Placement { planet: $planet2 })
        WHERE a.orb <= $maxOrb
        RETURN DISTINCT p1.chartId as chartId
      `, { planet1, planet2, type: aspectType, maxOrb });
      return result.records.map(r => r.get("chartId") as string);
    } finally { await session.close(); }
  }
}

const PLANET_REFERENCE = [
  { name: "Sun", symbol: "☉", glyph: "Su" }, { name: "Moon", symbol: "☽", glyph: "Mo" },
  { name: "Mercury", symbol: "☿", glyph: "Me" }, { name: "Venus", symbol: "♀", glyph: "Ve" },
  { name: "Mars", symbol: "♂", glyph: "Ma" }, { name: "Jupiter", symbol: "♃", glyph: "Ju" },
  { name: "Saturn", symbol: "♄", glyph: "Sa" }, { name: "Uranus", symbol: "♅", glyph: "Ur" },
  { name: "Neptune", symbol: "♆", glyph: "Ne" }, { name: "Pluto", symbol: "♇", glyph: "Pl" },
  { name: "NorthNode", symbol: "☊", glyph: "NN" }, { name: "Chiron", symbol: "⚷", glyph: "Ch" },
  { name: "Lilith", symbol: "⚸", glyph: "Li" },
];

const SIGN_REFERENCE = [
  { name: "Aries", element: "fire", modality: "cardinal", ruler: "Mars", degrees: 0 },
  { name: "Taurus", element: "earth", modality: "fixed", ruler: "Venus", degrees: 30 },
  { name: "Gemini", element: "air", modality: "mutable", ruler: "Mercury", degrees: 60 },
  { name: "Cancer", element: "water", modality: "cardinal", ruler: "Moon", degrees: 90 },
  { name: "Leo", element: "fire", modality: "fixed", ruler: "Sun", degrees: 120 },
  { name: "Virgo", element: "earth", modality: "mutable", ruler: "Mercury", degrees: 150 },
  { name: "Libra", element: "air", modality: "cardinal", ruler: "Venus", degrees: 180 },
  { name: "Scorpio", element: "water", modality: "fixed", ruler: "Mars", degrees: 210 },
  { name: "Sagittarius", element: "fire", modality: "mutable", ruler: "Jupiter", degrees: 240 },
  { name: "Capricorn", element: "earth", modality: "cardinal", ruler: "Saturn", degrees: 270 },
  { name: "Aquarius", element: "air", modality: "fixed", ruler: "Saturn", degrees: 300 },
  { name: "Pisces", element: "water", modality: "mutable", ruler: "Jupiter", degrees: 330 },
];

export const neo4jService = new Neo4jService();
