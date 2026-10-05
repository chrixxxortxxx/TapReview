// Philippine location reference data used by forms, filters and the admin map.
// The same data seeds the `regions`, `provinces` and `cities` tables (see scripts/generate-seed.mjs).

export const REGIONS = [
  { code: 'NCR', name: 'National Capital Region', short: 'NCR' },
  { code: 'CAR', name: 'Cordillera Administrative Region', short: 'CAR' },
  { code: 'I', name: 'Ilocos Region', short: 'Region I' },
  { code: 'II', name: 'Cagayan Valley', short: 'Region II' },
  { code: 'III', name: 'Central Luzon', short: 'Region III' },
  { code: 'IV-A', name: 'CALABARZON', short: 'Region IV-A' },
  { code: 'IV-B', name: 'MIMAROPA', short: 'Region IV-B' },
  { code: 'V', name: 'Bicol Region', short: 'Region V' },
  { code: 'VI', name: 'Western Visayas', short: 'Region VI' },
  { code: 'VII', name: 'Central Visayas', short: 'Region VII' },
  { code: 'NIR', name: 'Negros Island Region', short: 'NIR' },
  { code: 'VIII', name: 'Eastern Visayas', short: 'Region VIII' },
  { code: 'IX', name: 'Zamboanga Peninsula', short: 'Region IX' },
  { code: 'X', name: 'Northern Mindanao', short: 'Region X' },
  { code: 'XI', name: 'Davao Region', short: 'Region XI' },
  { code: 'XII', name: 'SOCCSKSARGEN', short: 'Region XII' },
  { code: 'XIII', name: 'Caraga', short: 'Region XIII' },
  { code: 'BARMM', name: 'Bangsamoro Autonomous Region in Muslim Mindanao', short: 'BARMM' },
]

export const PROVINCES = {
  NCR: ['Metro Manila'],
  CAR: ['Abra', 'Apayao', 'Benguet', 'Ifugao', 'Kalinga', 'Mountain Province'],
  I: ['Ilocos Norte', 'Ilocos Sur', 'La Union', 'Pangasinan'],
  II: ['Batanes', 'Cagayan', 'Isabela', 'Nueva Vizcaya', 'Quirino'],
  III: ['Aurora', 'Bataan', 'Bulacan', 'Nueva Ecija', 'Pampanga', 'Tarlac', 'Zambales'],
  'IV-A': ['Batangas', 'Cavite', 'Laguna', 'Quezon', 'Rizal'],
  'IV-B': ['Marinduque', 'Occidental Mindoro', 'Oriental Mindoro', 'Palawan', 'Romblon'],
  V: ['Albay', 'Camarines Norte', 'Camarines Sur', 'Catanduanes', 'Masbate', 'Sorsogon'],
  VI: ['Aklan', 'Antique', 'Capiz', 'Guimaras', 'Iloilo'],
  VII: ['Bohol', 'Cebu'],
  NIR: ['Negros Occidental', 'Negros Oriental', 'Siquijor'],
  VIII: ['Biliran', 'Eastern Samar', 'Leyte', 'Northern Samar', 'Samar', 'Southern Leyte'],
  IX: ['Zamboanga del Norte', 'Zamboanga del Sur', 'Zamboanga Sibugay'],
  X: ['Bukidnon', 'Camiguin', 'Lanao del Norte', 'Misamis Occidental', 'Misamis Oriental'],
  XI: ['Davao de Oro', 'Davao del Norte', 'Davao del Sur', 'Davao Occidental', 'Davao Oriental'],
  XII: ['Cotabato', 'Sarangani', 'South Cotabato', 'Sultan Kudarat'],
  XIII: ['Agusan del Norte', 'Agusan del Sur', 'Dinagat Islands', 'Surigao del Norte', 'Surigao del Sur'],
  BARMM: ['Basilan', 'Lanao del Sur', 'Maguindanao del Norte', 'Maguindanao del Sur', 'Sulu', 'Tawi-Tawi'],
}

// [province, city/municipality, lat, lng]
const CITY_ROWS = [
  ['Metro Manila', 'Manila', 14.5995, 120.9842],
  ['Metro Manila', 'Makati', 14.5547, 121.0244],
  ['Metro Manila', 'Quezon City', 14.676, 121.0437],
  ['Metro Manila', 'Taguig', 14.5176, 121.0509],
  ['Metro Manila', 'Pasig', 14.5764, 121.0851],
  ['Metro Manila', 'Mandaluyong', 14.5794, 121.0359],
  ['Metro Manila', 'Pasay', 14.5378, 121.0014],
  ['Metro Manila', 'Parañaque', 14.4793, 121.0198],
  ['Metro Manila', 'Caloocan', 14.6507, 120.9668],
  ['Metro Manila', 'San Juan', 14.6019, 121.0355],
  ['Metro Manila', 'Muntinlupa', 14.4081, 121.0415],
  ['Metro Manila', 'Marikina', 14.6507, 121.1029],
  ['Metro Manila', 'Las Piñas', 14.4445, 120.9939],
  ['Metro Manila', 'Valenzuela', 14.7011, 120.983],
  ['Benguet', 'Baguio City', 16.4023, 120.596],
  ['Benguet', 'La Trinidad', 16.455, 120.5874],
  ['Ilocos Norte', 'Laoag City', 18.196, 120.5927],
  ['Ilocos Sur', 'Vigan City', 17.5747, 120.3869],
  ['La Union', 'San Fernando', 16.6159, 120.3166],
  ['Pangasinan', 'Dagupan City', 16.0433, 120.3333],
  ['Cagayan', 'Tuguegarao City', 17.6132, 121.727],
  ['Isabela', 'Santiago City', 16.688, 121.5487],
  ['Isabela', 'Ilagan', 17.1489, 121.8893],
  ['Pampanga', 'Angeles City', 15.145, 120.5887],
  ['Pampanga', 'San Fernando', 15.0286, 120.6898],
  ['Bulacan', 'Malolos', 14.8527, 120.816],
  ['Bulacan', 'Meycauayan', 14.7344, 120.9572],
  ['Zambales', 'Olongapo', 14.8292, 120.2828],
  ['Tarlac', 'Tarlac City', 15.4802, 120.5979],
  ['Nueva Ecija', 'Cabanatuan', 15.4865, 120.9675],
  ['Cavite', 'Bacoor', 14.4624, 120.9645],
  ['Cavite', 'Tagaytay', 14.1153, 120.9621],
  ['Cavite', 'Dasmariñas', 14.3294, 120.9367],
  ['Laguna', 'Santa Rosa', 14.3122, 121.1114],
  ['Laguna', 'Calamba', 14.2117, 121.1653],
  ['Laguna', 'San Pablo', 14.0683, 121.3256],
  ['Batangas', 'Batangas City', 13.7565, 121.0583],
  ['Batangas', 'Lipa', 13.9411, 121.1631],
  ['Rizal', 'Antipolo', 14.5864, 121.176],
  ['Quezon', 'Lucena', 13.9372, 121.617],
  ['Palawan', 'Puerto Princesa', 9.7392, 118.7353],
  ['Palawan', 'El Nido', 11.1956, 119.4075],
  ['Palawan', 'Coron', 11.9986, 120.2043],
  ['Oriental Mindoro', 'Calapan', 13.4115, 121.1803],
  ['Albay', 'Legazpi', 13.1391, 123.7438],
  ['Camarines Sur', 'Naga City', 13.6218, 123.1948],
  ['Sorsogon', 'Sorsogon City', 12.9742, 124.0058],
  ['Iloilo', 'Iloilo City', 10.7202, 122.5621],
  ['Aklan', 'Kalibo', 11.7061, 122.3649],
  ['Aklan', 'Malay (Boracay)', 11.9674, 121.9248],
  ['Capiz', 'Roxas City', 11.5853, 122.7511],
  ['Negros Occidental', 'Bacolod', 10.6407, 122.9689],
  ['Negros Oriental', 'Dumaguete', 9.3068, 123.3054],
  ['Cebu', 'Cebu City', 10.3157, 123.8854],
  ['Cebu', 'Mandaue', 10.3236, 123.9223],
  ['Cebu', 'Lapu-Lapu', 10.3103, 123.9494],
  ['Cebu', 'Talisay', 10.2447, 123.8494],
  ['Bohol', 'Tagbilaran', 9.65, 123.85],
  ['Bohol', 'Panglao', 9.58, 123.75],
  ['Leyte', 'Tacloban', 11.2433, 125.0039],
  ['Leyte', 'Ormoc', 11.0064, 124.6075],
  ['Zamboanga del Sur', 'Zamboanga City', 6.9214, 122.079],
  ['Zamboanga del Sur', 'Pagadian', 7.8257, 123.437],
  ['Zamboanga del Norte', 'Dipolog', 8.5872, 123.3409],
  ['Misamis Oriental', 'Cagayan de Oro', 8.4542, 124.6319],
  ['Bukidnon', 'Malaybalay', 8.1575, 125.1278],
  ['Bukidnon', 'Valencia', 7.9064, 125.0942],
  ['Lanao del Norte', 'Iligan', 8.228, 124.2452],
  ['Camiguin', 'Mambajao', 9.2504, 124.7156],
  ['Davao del Sur', 'Davao City', 7.1907, 125.4553],
  ['Davao del Sur', 'Digos', 6.7497, 125.3572],
  ['Davao del Norte', 'Tagum', 7.4478, 125.8078],
  ['Davao del Norte', 'Island Garden City of Samal', 7.0731, 125.7088],
  ['Davao Oriental', 'Mati', 6.9551, 126.2167],
  ['South Cotabato', 'Koronadal', 6.5031, 124.8469],
  ['South Cotabato', 'General Santos', 6.1164, 125.1716],
  ['Cotabato', 'Kidapawan', 7.0083, 125.0894],
  ['Agusan del Norte', 'Butuan', 8.9475, 125.5406],
  ['Surigao del Norte', 'Surigao City', 9.7838, 125.4888],
  ['Surigao del Norte', 'General Luna (Siargao)', 9.7843, 126.1563],
  ['Maguindanao del Norte', 'Cotabato City', 7.2236, 124.2464],
  ['Lanao del Sur', 'Marawi', 8.0034, 124.2839],
]

export const PROVINCE_REGION = Object.fromEntries(
  Object.entries(PROVINCES).flatMap(([code, list]) => list.map((p) => [p, code])),
)

export const CITIES = CITY_ROWS.map(([province, name, lat, lng]) => ({
  province,
  name,
  lat,
  lng,
  region: PROVINCE_REGION[province],
}))

export const PH_CENTER = [12.3, 122.6]
export const PH_BOUNDS = [
  [4.2, 116.0],
  [21.4, 127.2],
]

export function regionName(code) {
  return REGIONS.find((r) => r.code === code)?.short ?? code ?? '—'
}

export function citiesOf(province) {
  return CITIES.filter((c) => c.province === province)
}

export function findCity(province, name) {
  return CITIES.find((c) => c.province === province && c.name === name)
}
