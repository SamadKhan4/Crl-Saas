const nextDay = [
  'Gondia',
  'Tiroda',
  'Tumsar',
  'Bhandara',
  'Sakoli',
  'Umred',
  'Nagbhid',
  'Bhivapur',
  'Bhramhapuri',
  'Gadchiroli',
  'Hinganghat',
  'Wani',
  'Bhadrawati',
  'Warora',
  'Chandrapur',
  'Wardha',
  'Yavatmal',
  'Katol',
  'Sawner',
  'Warud',
  'Amravati',
  'Akot',
  'Akola',
  'Murtizapur',
];

const longDistance = [
  ['Shegaon', 2],
  ['Khamgaon', 2],
  ['Washim', 2],
  ['Buldhana', 2],
  ['Jalna', 3],
  ['Jalgaon', 3],
  ['Nashik', 3],
  ['Thane', 3],
  ['Bhiwandi', 3],
  ['Kalyan', 4],
  ['Vasai', 4],
  ['Pune', 4],
  ['Aurangabad', 3],
];

export const serviceLocations = [
  ...nextDay.map((location) => ({ location, transitDays: 1, serviceLevel: 'NEXT_DAY' })),
  ...longDistance.map(([location, transitDays]) => ({
    location,
    transitDays,
    serviceLevel: 'LONG_DISTANCE',
  })),
];

export const serviceLocationNames = serviceLocations.map(({ location }) => location);

const normalizeLocation = (value = '') =>
  String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export const destinationFromPincode = (place, rates = []) => {
  if (!place) return null;
  const placeNames = [place.name, place.district].map(normalizeLocation).filter(Boolean);
  const service = serviceLocations.find(({ location }) => {
    const normalized = normalizeLocation(location);
    return placeNames.some((name) => name === normalized || name.startsWith(`${normalized} `) || name.includes(` ${normalized} `));
  });
  const name = service?.location || place.district || place.name;
  const rate = rates.find(({ location }) => normalizeLocation(location) === normalizeLocation(name));
  return {
    id: `pincode-${place.pincode}-${normalizeLocation(name).replace(/\s+/g, '-')}`,
    name,
    district: service?.location || place.district || name,
    pincode: place.pincode,
    transitDays: service?.transitDays,
    serviceLevel: service?.serviceLevel,
    ratePerKg: rate ? Number(rate.ratePerKg) : undefined,
    hasConfiguredRate: Boolean(rate),
  };
};

export const addTransitDays = (dateValue, transitDays) => {
  const date = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();
  date.setDate(date.getDate() + Number(transitDays || 0));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
