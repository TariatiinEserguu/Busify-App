/**
 * DEMONSTRATION DATA — NOT REAL BUS ROUTES.
 *
 * The routes and stops below are invented for classroom demonstrations.
 * Coordinates are placed roughly around central Ulaanbaatar only so the map
 * shows something sensible; they do not correspond to real bus stops or real
 * routes, and nothing here should be used for actual travel. Enter real data
 * through Admin → Routes / Stops.
 */

export interface DemoStop {
  code: string;
  name: string;
  lat: number;
  lng: number;
  description?: string;
}

export const DEMO_STOPS: DemoStop[] = [
  // East–west line
  { code: 'DEMO-01', name: 'West Depot (demo)', lat: 47.915, lng: 106.845 },
  { code: 'DEMO-02', name: 'Riverside Park (demo)', lat: 47.9158, lng: 106.8555 },
  { code: 'DEMO-03', name: 'Textile Works (demo)', lat: 47.9165, lng: 106.866 },
  { code: 'DEMO-04', name: 'Old Market (demo)', lat: 47.9172, lng: 106.8765 },
  { code: 'DEMO-05', name: 'Radio Tower (demo)', lat: 47.9178, lng: 106.887 },
  { code: 'DEMO-06', name: 'Theatre Square (demo)', lat: 47.9183, lng: 106.8975 },
  {
    code: 'DEMO-07',
    name: 'Central Plaza (demo)',
    lat: 47.9187,
    lng: 106.908,
    description: 'Demo interchange served by several demo lines.',
  },
  { code: 'DEMO-08', name: 'City Library (demo)', lat: 47.919, lng: 106.9185 },
  { code: 'DEMO-09', name: 'University Gate (demo)', lat: 47.9192, lng: 106.929 },
  { code: 'DEMO-10', name: 'Hospital East (demo)', lat: 47.9193, lng: 106.9395 },
  { code: 'DEMO-11', name: 'Sports Complex (demo)', lat: 47.9191, lng: 106.95 },
  { code: 'DEMO-12', name: 'East Terminal (demo)', lat: 47.9188, lng: 106.9605 },
  // North–south line
  { code: 'DEMO-20', name: 'North Hills (demo)', lat: 47.942, lng: 106.903 },
  { code: 'DEMO-21', name: 'Northern Residential (demo)', lat: 47.9365, lng: 106.9042 },
  { code: 'DEMO-22', name: "Children's Park (demo)", lat: 47.931, lng: 106.9055 },
  { code: 'DEMO-23', name: 'Post Office (demo)', lat: 47.925, lng: 106.9068 },
  { code: 'DEMO-24', name: 'Bridge Street (demo)', lat: 47.9125, lng: 106.9092 },
  { code: 'DEMO-25', name: 'South Junction (demo)', lat: 47.9065, lng: 106.9105 },
  { code: 'DEMO-26', name: 'Southern Depot (demo)', lat: 47.9005, lng: 106.9118 },
  // Campus shuttle
  { code: 'DEMO-30', name: 'Innovation Park (demo)', lat: 47.9235, lng: 106.93 },
  { code: 'DEMO-31', name: 'Student Dormitories (demo)', lat: 47.9268, lng: 106.9378 },
  {
    code: 'DEMO-32',
    name: 'College Campus (demo)',
    lat: 47.9295,
    lng: 106.9455,
    description: 'Demo terminus for the campus shuttle.',
  },
  // Draft express
  { code: 'DEMO-40', name: 'Airport Road (demo)', lat: 47.8905, lng: 106.86 },
];

export interface DemoRoute {
  number: string;
  name: string;
  description: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  color: string;
  firstDeparture?: string;
  lastDeparture?: string;
  headwayMinutes?: number;
  stops: string[];
}

export const DEMO_ROUTES: DemoRoute[] = [
  {
    number: 'D1',
    name: 'East–West Demo Line',
    description: 'Demonstration route across the city centre. Not a real bus line.',
    status: 'ACTIVE',
    color: '#1d4ed8',
    firstDeparture: '06:30',
    lastDeparture: '22:30',
    headwayMinutes: 8,
    stops: ['DEMO-01', 'DEMO-02', 'DEMO-03', 'DEMO-04', 'DEMO-05', 'DEMO-06', 'DEMO-07', 'DEMO-08', 'DEMO-09', 'DEMO-10', 'DEMO-11', 'DEMO-12'],
  },
  {
    number: 'D2',
    name: 'North–South Demo Line',
    description: 'Demonstration route crossing D1 at Central Plaza. Not a real bus line.',
    status: 'ACTIVE',
    color: '#0f766e',
    firstDeparture: '06:45',
    lastDeparture: '21:45',
    headwayMinutes: 12,
    stops: ['DEMO-20', 'DEMO-21', 'DEMO-22', 'DEMO-23', 'DEMO-07', 'DEMO-24', 'DEMO-25', 'DEMO-26'],
  },
  {
    number: 'D3',
    name: 'Campus Shuttle (demo)',
    description: 'Short demonstration shuttle to the college campus. Not a real bus line.',
    status: 'ACTIVE',
    color: '#b45309',
    firstDeparture: '07:30',
    lastDeparture: '19:00',
    headwayMinutes: 15,
    stops: ['DEMO-07', 'DEMO-08', 'DEMO-30', 'DEMO-31', 'DEMO-32'],
  },
  {
    number: 'D4',
    name: 'Night Service (demo)',
    description: 'Example of a suspended route: hidden from passengers until reactivated.',
    status: 'INACTIVE',
    color: '#6d28d9',
    firstDeparture: '23:00',
    lastDeparture: '04:30',
    headwayMinutes: 40,
    stops: ['DEMO-01', 'DEMO-04', 'DEMO-07', 'DEMO-12'],
  },
  {
    number: 'D9',
    name: 'Airport Express (draft)',
    description: 'Example of a draft route that administrators are still preparing.',
    status: 'DRAFT',
    color: '#be123c',
    stops: ['DEMO-07', 'DEMO-02', 'DEMO-40'],
  },
];

export const DEMO_ACCOUNTS = [
  { key: 'admin', email: 'admin@busify.local', name: 'Demo Administrator', role: 'ADMIN' },
  { key: 'support', email: 'support@busify.local', name: 'Demo Support Agent', role: 'SUPPORT' },
  { key: 'passenger', email: 'passenger@busify.local', name: 'Demo Passenger', role: 'PASSENGER' },
  { key: 'rider', email: 'rider@busify.local', name: 'Second Demo Passenger', role: 'PASSENGER' },
] as const;
