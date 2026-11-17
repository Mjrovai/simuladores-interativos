// ============================================================
// 14-BIS · Historical data (all values sourced — see SOURCES)
// Geometry: JATM 3(2):137-146 (2011), Table 1 + Fig. 2 sketch
// Specs:    Wikipedia / Opdycke (1999) / Gray (2006)
// ============================================================

// Longitudinal stations measured from the nose (metres).
// The 3D model is built in these coordinates, then shifted so
// the origin sits at the centre of gravity (CG_X).
export const GEO = {
  length: 9.9,            // overall length ~10 m (JATM: 10 m; sketch 9.56 m)
  span: 11.5,             // wingspan (Opdycke)
  chord: 2.5,             // wing chord (Opdycke)
  gap: 2.3,               // gap between upper & lower wing planes
  dihedral: 10 * Math.PI / 180,   // 10 deg (JATM)
  cellsPerWing: 3,        // "wings, each made up of three cells" (Wikipedia)
  cellWidth: 1.7,         // 3 x 1.7 = 5.1 m per panel
  centerGap: 1.3,         // gap between wing roots (boom + engine pass through)
  boomY: 1.4,             // boom centreline height above ground (static)
  wingLE: 7.2,            // wing leading edge station
  cgX: 7.5,               // CG estimate (JATM/ENCIT: 7.5 m from nose)
  wheelX: 7.6,            // main wheels just aft of CG (taildragger)
  wheelR: 0.35,           // bicycle-type wheels ~0.7 m diameter
  wheelTrack: 0.9,        // lateral distance between wheels
  skidX: 0.9,             // nose skid station
  basketX: 6.4,           // wicker basket (pilot stands)
  engineX: 8.9,           // Antoinette V8 behind the pilot
  propX: 9.95,            // pusher propeller plane
  propR: 1.0,             // 2 m diameter (Opdycke)
  canard: { x: 1.2, span: 2.0, chord: 2.0, gap: 1.7 },  // JATM Table 1
  staticPitch: 3 * Math.PI / 180,  // nose-up rest attitude on skid + wheels
};

export const SPECS = [
  ['Role', 'Experimental canard biplane — "Oiseau de proie" (Bird of Prey)'],
  ['Designer', 'Alberto Santos-Dumont, with Gabriel Voisin'],
  ['First flight', '23 October 1906 · Bagatelle, Paris'],
  ['Crew', '1 (standing, in a wicker basket)'],
  ['Length', '≈ 10 m'],
  ['Wingspan', '11.5 m'],
  ['Height', '3.75 m'],
  ['Wing chord', '2.5 m'],
  ['Wing area', '52 m² (Hargrave cells, 10° dihedral)'],
  ['Canard', '2 × 2 m box-kite cell, 8 m² — elevator + rudder'],
  ['Gross weight', '290 kg (≈ 300 kg with pilot & fuel)'],
  ['Engine', 'Antoinette 8V · water-cooled V-8 · 37 kW (50 hp) @ 1,500 rpm'],
  ['Propeller', '2-blade paddle, aluminium, 2 m diameter — pusher'],
  ['Structure', 'Bamboo & pine, aluminium sockets, Japanese silk cover'],
  ['Max speed', '≈ 40–43 km/h (11–12 m/s)'],
  ['Landing gear', '2 bicycle wheels aft + curved nose skid'],
];

export const HISTORY = [
  { date: '22 Jul 1906', title: 'First trials — towed by airship',
    text: 'Assembled at Neuilly, the aeroplane is suspended beneath Santos-Dumont\'s airship No. 14 to simulate flight — hence the name "14-bis". The loads nearly tear the envelope; the tests are abandoned.' },
  { date: 'Jul–Aug 1906', title: 'Bagatelle & the zip-line',
    text: 'Moved to the Château de Bagatelle grounds (Bois de Boulogne). Tests continue hung from a pulley on a 60 m steel cable strung between posts 13.5 m and 7 m high.' },
  { date: '21–22 Aug 1906', title: 'First free trials — underpowered',
    text: 'At the Polo Ground the nosewheel lifts, but the 24 hp Antoinette cannot take off. The aluminium propeller replaces the silk-covered wooden one; the engine is swapped for a proven 50 hp Antoinette 8V.' },
  { date: '13 Sep 1906', title: 'First official hop',
    text: 'Before Aéro-Club de France observers: a hop of 4–7 m at ~0.7 m altitude. The nose-up landing breaks the propeller. No prize — but an ovation from the crowd.' },
  { date: '23 Oct 1906', title: 'The Archdeacon Prize',
    text: 'A flight of over 50 m (commonly cited as ~60 m) at 3–5 m altitude, publicly witnessed and filmed. Wins the Coupe Ernest Archdeacon (3,000 francs) for the first public flight of 25 m or more in Europe. No ailerons yet.' },
  { date: 'Oct–Nov 1906', title: 'Octagonal ailerons fitted',
    text: 'After landing damage, repairs add octagonal interplane ailerons to the outermost wing cells, pivoting between the forward struts — worked by cables attached to the pilot\'s shoulders, like the Wrights\' hip cradle.' },
  { date: '12 Nov 1906', title: 'The first world record',
    text: 'At sunset, before the Aéro-Club de France: 220 m in 21.5 s (~37 km/h), engine cut, glide to land. Henry Farman follows in a car, dropping a plate at each lift-off and touch-down. First officially homologated aeroplane record — distance, speed and time. Prize: 1,000 francs for 100 m+.' },
  { date: 'Legacy', title: 'The father of aviation in Europe',
    text: 'The 14-bis took off on its own wheels, unassisted by catapult or rail, before a crowd and official timers. Its flights were the first publicly witnessed, filmed and homologated heavier-than-air flights in Europe. Santos-Dumont never patented his designs.' },
];

export const PARTS = {
  canard: {
    title: 'Canard — elevator & rudder',
    text: 'A 2 × 2 m Hargrave box-kite cell on a universal joint at the nose. Tilted up/down it acts as the elevator; tilted sideways it acts as the rudder. One control surface, two jobs — the layout that would later be called "canard". Control cables run back to the pilot\'s basket.',
  },
  wings: {
    title: 'Hargrave-cell wings',
    text: 'Each wing is three box-kite cells: upper and lower silk planes joined by vertical fabric curtains, braced with wooden struts and piano wire. Based on Lawrence Hargrave\'s 1893 box kite — rigid and inherently stable. Total span 11.5 m, chord 2.5 m, area 52 m².',
  },
  dihedral: {
    title: '10° dihedral — passive stability',
    text: 'The wings rise in a shallow V. With no ailerons (October configuration), this dihedral is the only lateral stability: a gust that drops a wing produces sideslip, and the dihedral rolls the machine back level. Turns are barely possible — the 14-bis flew straight.',
  },
  basket: {
    title: 'The wicker basket',
    text: 'Santos-Dumont stood upright in an open wicker nacelle — an aeronaut\'s basket from his airship days — immediately in front of the engine. No seat, no enclosure: he worked the control cables with his hands and, in November, with his shoulders.',
  },
  engine: {
    title: 'Antoinette 8V · 50 hp',
    text: 'Léon Levavasseur\'s water-cooled, fuel-injected V-8: 37 kW at 1,500 rpm, mounted at the extreme rear between the wing roots. The original 24 hp version could not lift the machine; the 50 hp upgrade of August 1906 made flight possible.',
  },
  propeller: {
    title: 'Pusher propeller',
    text: 'A 2 m, two-bladed paddle propeller behind the engine — aluminium blades (replacing silk-covered wood). It pushes the machine through the air; the pilot stands directly in front of it. Paddle blades were inefficient: much of the 50 hp never became thrust.',
  },
  gear: {
    title: 'Wheels & nose skid',
    text: 'Two spoked bicycle wheels under the centre of gravity and a curved skid under the nose. No catapult, no rail: the 14-bis ran down the grass on its own wheels, rotated nose-up about the axle, and lifted off — the first self-launched aeroplane flight in Europe.',
  },
  ailerons: {
    title: 'Octagonal ailerons (Nov 1906)',
    text: 'Added after the October flights: horizontal octagonal surfaces in the interplane gap of each outermost cell, pivoted on the forward struts and protruding past the leading edge — like Esnault-Pelterie\'s 1904 glider "gouvernails horizontaux". Cables to the pilot\'s shoulders let him lean into a turn: differential incidence rolls the machine. Weak by modern standards — the 14-bis was never fully controllable.',
  },
  boom: {
    title: 'The bamboo boom',
    text: 'A long tapered lattice girder of bamboo and pine with aluminium sockets, marked "14". It carries the canard at the nose, the basket and engine at the rear, and passes between the wing roots at mid-gap. The whole airframe is one open truss — no fuselage.',
  },
};

export const MISSIONS = {
  free: {
    name: 'Free flight',
    date: 'Bagatelle · 1906',
    goal: 'Explore the machine. Start the engine, run down the field, pull the canard up and fly.',
    target: null,
  },
  oct23: {
    name: '23 October 1906',
    date: 'Coupe Ernest Archdeacon',
    goal: 'Fly 25 m or more before witnesses — the first public powered flight prize in Europe. Santos-Dumont flew ~60 m at 3–5 m altitude.',
    target: 25,
    record: { dist: 60, alt: '3–5 m', prize: '3,000 francs' },
    config: 'oct',
  },
  nov12: {
    name: '12 November 1906',
    date: 'First homologated world record',
    goal: 'Fly 100 m or more. Santos-Dumont\'s record at sunset: 220 m in 21.5 s (~37 km/h), with octagonal ailerons and Henry Farman\'s car following alongside.',
    target: 100,
    record: { dist: 220, time: 21.5, speed: '≈ 37 km/h', prize: '1,000 francs' },
    config: 'nov',
  },
};

export const SOURCES = [
  { label: 'Wikipedia — Santos-Dumont 14-bis', url: 'https://en.wikipedia.org/wiki/Santos-Dumont_14-bis',
    note: 'Design, operational history, specifications (Opdycke, French Aeroplanes before the Great War, 1999; Gray, WWI Aero 194, 2006).' },
  { label: 'Bitencourt et al. (2011) — A CFD-based analysis of the 14-Bis aircraft aerodynamics and stability',
    url: 'https://doi.org/10.5028/jatm.2011.03021711',
    note: 'J. Aerosp. Technol. Manag. 3(2):137–146. Geometry Table 1; CLα = 4.85 /rad; drag polar CD = 0.089 − 0.206·CL + 0.252·CL² (clean CFD model); viable flight: α 5–10°, canard ±5°, 11–14 m/s; marginal longitudinal stability; roll–yaw coupling; ground effect.' },
  { label: 'ENCIT 2006 — Dumont\'s 14-bis (ABCM)',
    url: 'https://www.abcm.org.br/anais/encit/2006/arquivos/Juntos/16.pdf',
    note: 'Bamboo & silk construction, aluminium fittings; canard 2 × 2 m, height 1.7 m; CG ≈ 7.5 m from nose; cruise 9–12 m/s.' },
  { label: 'Photographs (public domain)',
    url: 'https://commons.wikimedia.org/wiki/Category:Santos-Dumont_14-bis',
    note: 'Final form, Nov 1906 (with octagonal ailerons); flight of 23 Oct 1906 — Wikimedia Commons.' },
];

export const DISCLAIMER =
  'Interactive reconstruction for education. Geometry follows published measurements and the 2011 CFD study; ' +
  'the flight model is a real-time approximation tuned to historical behaviour (long ground run, marginal climb, ' +
  '9–12 m/s), not a certified simulation. The CFD drag polar is "clean" — struts, wires, pilot and gear add ' +
  'substantial drag, which is why the real machine was so marginal.';