export const CPU_OPPONENTS = {
  easy: { name: 'Mochi', label: 'Einfach', description: 'Neugierig und etwas tollpatschig. Probiert viel aus und übersieht Gefahren.' },
  medium: { name: 'Kiko', label: 'Mittel', description: 'Aufmerksam und mutig. Merkt sich Gefahren, wagt aber auch riskante Züge.' },
  hard: { name: 'Mr. Miyagi', label: 'Schwer', description: 'Geduldig und taktisch. Schützt seine Flagge und lernt aus deinen Duellen – bleibt aber fehlbar.' },
} as const;

export type CpuDifficulty = keyof typeof CPU_OPPONENTS;
export function isCpuDifficulty(value: unknown): value is CpuDifficulty {
  return value === 'easy' || value === 'medium' || value === 'hard';
}
