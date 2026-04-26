// ============================================================
// ASTRO PLATFORM — Neo4j Initial Seed
// Run: LOAD CSV / CALL apoc.cypher.runFile('/import/seed.cypher')
// ============================================================

// Constraints
CREATE CONSTRAINT planet_name IF NOT EXISTS FOR (p:Planet) REQUIRE p.name IS UNIQUE;
CREATE CONSTRAINT sign_name   IF NOT EXISTS FOR (s:Sign)   REQUIRE s.name IS UNIQUE;
CREATE CONSTRAINT chart_id    IF NOT EXISTS FOR (c:Chart)  REQUIRE c.id   IS UNIQUE;
CREATE CONSTRAINT user_id     IF NOT EXISTS FOR (u:User)   REQUIRE u.id   IS UNIQUE;

// Indexes
CREATE INDEX chart_userId     IF NOT EXISTS FOR (c:Chart)     ON (c.userId);
CREATE INDEX placement_planet IF NOT EXISTS FOR (p:Placement) ON (p.planet);
CREATE INDEX placement_sign   IF NOT EXISTS FOR (p:Placement) ON (p.sign);
CREATE INDEX placement_house  IF NOT EXISTS FOR (p:Placement) ON (p.house);

// ── Planets ─────────────────────────────────────────────────
MERGE (:Planet { name: 'Sun',       symbol: '☉', glyph: 'Su', speed_avg: 1.0   });
MERGE (:Planet { name: 'Moon',      symbol: '☽', glyph: 'Mo', speed_avg: 13.18 });
MERGE (:Planet { name: 'Mercury',   symbol: '☿', glyph: 'Me', speed_avg: 1.38  });
MERGE (:Planet { name: 'Venus',     symbol: '♀', glyph: 'Ve', speed_avg: 1.20  });
MERGE (:Planet { name: 'Mars',      symbol: '♂', glyph: 'Ma', speed_avg: 0.52  });
MERGE (:Planet { name: 'Jupiter',   symbol: '♃', glyph: 'Ju', speed_avg: 0.083 });
MERGE (:Planet { name: 'Saturn',    symbol: '♄', glyph: 'Sa', speed_avg: 0.034 });
MERGE (:Planet { name: 'Uranus',    symbol: '♅', glyph: 'Ur', speed_avg: 0.012 });
MERGE (:Planet { name: 'Neptune',   symbol: '♆', glyph: 'Ne', speed_avg: 0.006 });
MERGE (:Planet { name: 'Pluto',     symbol: '♇', glyph: 'Pl', speed_avg: 0.004 });
MERGE (:Planet { name: 'NorthNode', symbol: '☊', glyph: 'NN', speed_avg: -0.053 });
MERGE (:Planet { name: 'Chiron',    symbol: '⚷', glyph: 'Ch', speed_avg: 0.019 });
MERGE (:Planet { name: 'Lilith',    symbol: '⚸', glyph: 'Li', speed_avg: 0.111 });

// ── Zodiac Signs ─────────────────────────────────────────────
MERGE (:Sign { name: 'Aries',       element: 'fire',  modality: 'cardinal', ruler: 'Mars',    degrees: 0   });
MERGE (:Sign { name: 'Taurus',      element: 'earth', modality: 'fixed',    ruler: 'Venus',   degrees: 30  });
MERGE (:Sign { name: 'Gemini',      element: 'air',   modality: 'mutable',  ruler: 'Mercury', degrees: 60  });
MERGE (:Sign { name: 'Cancer',      element: 'water', modality: 'cardinal', ruler: 'Moon',    degrees: 90  });
MERGE (:Sign { name: 'Leo',         element: 'fire',  modality: 'fixed',    ruler: 'Sun',     degrees: 120 });
MERGE (:Sign { name: 'Virgo',       element: 'earth', modality: 'mutable',  ruler: 'Mercury', degrees: 150 });
MERGE (:Sign { name: 'Libra',       element: 'air',   modality: 'cardinal', ruler: 'Venus',   degrees: 180 });
MERGE (:Sign { name: 'Scorpio',     element: 'water', modality: 'fixed',    ruler: 'Mars',    degrees: 210 });
MERGE (:Sign { name: 'Sagittarius', element: 'fire',  modality: 'mutable',  ruler: 'Jupiter', degrees: 240 });
MERGE (:Sign { name: 'Capricorn',   element: 'earth', modality: 'cardinal', ruler: 'Saturn',  degrees: 270 });
MERGE (:Sign { name: 'Aquarius',    element: 'air',   modality: 'fixed',    ruler: 'Saturn',  degrees: 300 });
MERGE (:Sign { name: 'Pisces',      element: 'water', modality: 'mutable',  ruler: 'Jupiter', degrees: 330 });

// ── Sign sequence ────────────────────────────────────────────
MATCH (a:Sign { name: 'Aries'       }), (b:Sign { name: 'Taurus'       }) MERGE (a)-[:NEXT]->(b);
MATCH (a:Sign { name: 'Taurus'      }), (b:Sign { name: 'Gemini'       }) MERGE (a)-[:NEXT]->(b);
MATCH (a:Sign { name: 'Gemini'      }), (b:Sign { name: 'Cancer'       }) MERGE (a)-[:NEXT]->(b);
MATCH (a:Sign { name: 'Cancer'      }), (b:Sign { name: 'Leo'          }) MERGE (a)-[:NEXT]->(b);
MATCH (a:Sign { name: 'Leo'         }), (b:Sign { name: 'Virgo'        }) MERGE (a)-[:NEXT]->(b);
MATCH (a:Sign { name: 'Virgo'       }), (b:Sign { name: 'Libra'        }) MERGE (a)-[:NEXT]->(b);
MATCH (a:Sign { name: 'Libra'       }), (b:Sign { name: 'Scorpio'      }) MERGE (a)-[:NEXT]->(b);
MATCH (a:Sign { name: 'Scorpio'     }), (b:Sign { name: 'Sagittarius'  }) MERGE (a)-[:NEXT]->(b);
MATCH (a:Sign { name: 'Sagittarius' }), (b:Sign { name: 'Capricorn'    }) MERGE (a)-[:NEXT]->(b);
MATCH (a:Sign { name: 'Capricorn'   }), (b:Sign { name: 'Aquarius'     }) MERGE (a)-[:NEXT]->(b);
MATCH (a:Sign { name: 'Aquarius'    }), (b:Sign { name: 'Pisces'       }) MERGE (a)-[:NEXT]->(b);
MATCH (a:Sign { name: 'Pisces'      }), (b:Sign { name: 'Aries'        }) MERGE (a)-[:NEXT]->(b);

// ── Planet rulerships (sign → planet) ────────────────────────
MATCH (s:Sign { name: 'Aries'       }), (p:Planet { name: 'Mars'    }) MERGE (s)-[:RULED_BY]->(p);
MATCH (s:Sign { name: 'Taurus'      }), (p:Planet { name: 'Venus'   }) MERGE (s)-[:RULED_BY]->(p);
MATCH (s:Sign { name: 'Gemini'      }), (p:Planet { name: 'Mercury' }) MERGE (s)-[:RULED_BY]->(p);
MATCH (s:Sign { name: 'Cancer'      }), (p:Planet { name: 'Moon'    }) MERGE (s)-[:RULED_BY]->(p);
MATCH (s:Sign { name: 'Leo'         }), (p:Planet { name: 'Sun'     }) MERGE (s)-[:RULED_BY]->(p);
MATCH (s:Sign { name: 'Virgo'       }), (p:Planet { name: 'Mercury' }) MERGE (s)-[:RULED_BY]->(p);
MATCH (s:Sign { name: 'Libra'       }), (p:Planet { name: 'Venus'   }) MERGE (s)-[:RULED_BY]->(p);
MATCH (s:Sign { name: 'Scorpio'     }), (p:Planet { name: 'Mars'    }) MERGE (s)-[:RULED_BY]->(p);
MATCH (s:Sign { name: 'Sagittarius' }), (p:Planet { name: 'Jupiter' }) MERGE (s)-[:RULED_BY]->(p);
MATCH (s:Sign { name: 'Capricorn'   }), (p:Planet { name: 'Saturn'  }) MERGE (s)-[:RULED_BY]->(p);
MATCH (s:Sign { name: 'Aquarius'    }), (p:Planet { name: 'Saturn'  }) MERGE (s)-[:RULED_BY]->(p);
MATCH (s:Sign { name: 'Pisces'      }), (p:Planet { name: 'Jupiter' }) MERGE (s)-[:RULED_BY]->(p);
