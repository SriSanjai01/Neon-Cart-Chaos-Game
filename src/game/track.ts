export interface Point {
  x: number;
  y: number;
}

export interface Checkpoint {
  p1: Point;
  p2: Point;
  id: number;
}

export interface TrackData {
  id: string;
  name: string;
  centerline: Point[];
  width: number;
  checkpoints: Checkpoint[];
  startGrid: Point[]; // where karts spawn
  startAngle: number;
  laps: number;
  itemBoxes: Point[];
}

function generateRoundedTrack(x: number, y: number, w: number, h: number, r: number, segmentsPerCorner = 15): Point[] {
  const points: Point[] = [];
  
  // Top straight (left to right)
  for (let i=0; i<=10; i++) {
     points.push({ x: x + r + (w - 2*r) * (i/10), y: y });
  }

  // Top right corner
  for(let i=0; i<=segmentsPerCorner; i++) {
    const angle = -Math.PI/2 + (i/segmentsPerCorner) * (Math.PI/2);
    points.push({ x: x + w - r + Math.cos(angle)*r, y: y + r + Math.sin(angle)*r });
  }
  
  // Right straight (top to bottom)
  for (let i=0; i<=10; i++) {
     points.push({ x: x + w, y: y + r + (h - 2*r) * (i/10) });
  }

  // Bottom right corner
  for(let i=0; i<=segmentsPerCorner; i++) {
    const angle = 0 + (i/segmentsPerCorner) * (Math.PI/2);
    points.push({ x: x + w - r + Math.cos(angle)*r, y: y + h - r + Math.sin(angle)*r });
  }
  
  // Bottom straight (right to left)
  for (let i=0; i<=10; i++) {
     points.push({ x: x + w - r - (w - 2*r) * (i/10), y: y + h });
  }

  // Bottom left corner
  for(let i=0; i<=segmentsPerCorner; i++) {
    const angle = Math.PI/2 + (i/segmentsPerCorner) * (Math.PI/2);
    points.push({ x: x + r + Math.cos(angle)*r, y: y + h - r + Math.sin(angle)*r });
  }
  
  // Left straight (bottom to top)
  for (let i=0; i<=10; i++) {
     points.push({ x: x, y: y + h - r - (h - 2*r) * (i/10) });
  }

  // Top left corner
  for(let i=0; i<=segmentsPerCorner; i++) {
    const angle = Math.PI + (i/segmentsPerCorner) * (Math.PI/2);
    points.push({ x: x + r + Math.cos(angle)*r, y: y + r + Math.sin(angle)*r });
  }
  
  // Close the loop
  points.push({...points[0]});
  return points;
}

function buildTrack(id: string, name: string, w: number, h: number, r: number): TrackData {
  const trackPath = generateRoundedTrack(0, 0, w, h, r);
  return {
    id,
    name,
    centerline: trackPath,
    width: 200,
    checkpoints: [
      { id: 0, p1: {x: w/2, y: -250}, p2: {x: w/2, y: 250} }, // Start/finish line
      { id: 1, p1: {x: w-250, y: h/2}, p2: {x: w+250, y: h/2} },
      { id: 2, p1: {x: w/2, y: h-250}, p2: {x: w/2, y: h+250} },
      { id: 3, p1: {x: -250, y: h/2}, p2: {x: 250, y: h/2} },
    ],
    // Fair Starting Grid! All karts on exactly the same x line (w/2 - 100), spaced out vertically
    startGrid: [
      {x: w/2 - 100, y: -60},
      {x: w/2 - 100, y: -20},
      {x: w/2 - 100, y: 20},
      {x: w/2 - 100, y: 60},
    ],
    startAngle: 0, // facing right
    laps: 3,
    itemBoxes: [
      {x: w/2 + 400, y: 0}, {x: w/2 + 400, y: 70}, {x: w/2 + 400, y: -70},
      {x: w/2 + 400, y: h}, {x: w/2 + 400, y: h+70}, {x: w/2 + 400, y: h-70}
    ]
  };
}

export const TRACKS: TrackData[] = [
  buildTrack('neon_circuit', 'Neon Circuit', 2000, 1000, 400),
  buildTrack('long_run', 'The Long Run', 3000, 1500, 500),
  buildTrack('tight_corners', 'Tight Corners', 1500, 2000, 300),
  buildTrack('speedway', 'Neon Speedway', 2500, 1000, 350),
  buildTrack('marathon', 'Marathon', 4000, 2000, 800),
  buildTrack('box_circuit', 'Box Circuit', 1800, 1800, 200),
  buildTrack('wide_turn', 'Wide Turn', 2200, 1200, 600),
  buildTrack('short_track', 'Short Track', 1200, 800, 200),
  buildTrack('the_oval', 'The Oval', 2000, 800, 400),
  buildTrack('grand_prix', 'Grand Prix', 3500, 1800, 700),
];

export const TestTrack = TRACKS[0]; // fallback for backwards compatibility while we refactor
