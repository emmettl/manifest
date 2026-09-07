export const regions = [
  { id: 'world', label: 'World', number: '00', center: [22, 10], zoom: 1, title: 'The ocean between us', description: 'Follow the movement. Let the sea lanes take shape.', caption: 'A global field of illustrative cargo and tanker journeys.' },
  { id: 'china', label: 'China', number: '01', center: [121, 24], zoom: 3.5, title: 'Factory tide', description: 'From the coast, toward the open sea.', caption: 'Illustrative departures from China’s eastern seaboard.' },
  { id: 'hormuz', label: 'Hormuz', number: '02', center: [57, 23], zoom: 6, title: 'Black current', description: 'A narrow passage into the Indian Ocean.', caption: 'Tanker-class demo journeys. No cargo contents are asserted.' },
  { id: 'malacca', label: 'Malacca', number: '03', center: [102, 3], zoom: 5, title: 'Needle eyes', description: 'An ocean of movement, threaded through a strait.', caption: 'Illustrative movement between the Indian and Pacific oceans.' },
  { id: 'suez', label: 'Suez', number: '04', center: [35, 27], zoom: 5, title: 'A seam between seas', description: 'Where geography concentrates the flow.', caption: 'A schematic passage through the Red Sea and Mediterranean.' },
] as const
export type Region = typeof regions[number]
