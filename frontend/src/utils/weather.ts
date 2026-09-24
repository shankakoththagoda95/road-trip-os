// WMO weather interpretation codes, as used by Open-Meteo.
const WeatherCodes: [codes: number[], emoji: string, label: string][] = [
  [[0], '☀️', 'Clear'],
  [[1], '🌤️', 'Mostly clear'],
  [[2], '⛅', 'Partly cloudy'],
  [[3], '☁️', 'Overcast'],
  [[45, 48], '🌫️', 'Fog'],
  [[51, 53, 55], '🌦️', 'Drizzle'],
  [[56, 57], '🌧️', 'Freezing drizzle'],
  [[61, 63], '🌧️', 'Rain'],
  [[65], '🌧️', 'Heavy rain'],
  [[66, 67], '🌧️', 'Freezing rain'],
  [[71, 73, 75, 77], '🌨️', 'Snow'],
  [[80, 81], '🌦️', 'Showers'],
  [[82], '⛈️', 'Violent showers'],
  [[85, 86], '🌨️', 'Snow showers'],
  [[95, 96, 99], '⛈️', 'Thunderstorm'],
];

export function describeWeather(code: number) {
  const match = WeatherCodes.find(([codes]) => codes.includes(code));

  return match
    ? { emoji: match[1], label: match[2] }
    : { emoji: '🌡️', label: 'Unknown' };
}
