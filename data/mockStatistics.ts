export const mockStatistics = {
  calendar: {
    currentMonth: 'abr.',
    selectedDate: '2026-04-27',
    activityDays: [
      { date: '2026-03-30', day: 30, currentMonth: false, level: null, time: null },
      { date: '2026-03-31', day: 31, currentMonth: false, level: null, time: null },
      { day: 1, currentMonth: true, level: null, time: null },
      { day: 2, currentMonth: true, level: null, time: null },
      { day: 3, currentMonth: true, level: null, time: null },
      { day: 4, currentMonth: true, level: null, time: null },
      { day: 5, currentMonth: true, level: null, time: null },
      { day: 6, currentMonth: true, level: null, time: null },
      { day: 7, currentMonth: true, level: null, time: null },
      { day: 8, currentMonth: true, level: null, time: null },
      { day: 9, currentMonth: true, level: null, time: null },
      { day: 10, currentMonth: true, level: null, time: null },
      { day: 11, currentMonth: true, level: null, time: null },
      { day: 12, currentMonth: true, level: null, time: null },
      { day: 13, currentMonth: true, level: null, time: null },
      { day: 14, currentMonth: true, level: null, time: null },
      { day: 15, currentMonth: true, level: null, time: null },
      { day: 16, currentMonth: true, level: null, time: null },
      { day: 17, currentMonth: true, level: null, time: null },
      { day: 18, currentMonth: true, level: null, time: null },
      { day: 19, currentMonth: true, level: null, time: null },
      { day: 20, currentMonth: true, level: null, time: null },
      { day: 21, currentMonth: true, level: null, time: null },
      { day: 22, currentMonth: true, level: null, time: null },
      { day: 23, currentMonth: true, level: null, time: null },
      { day: 24, currentMonth: true, level: null, time: null },
      { day: 25, currentMonth: true, level: null, time: null },
      { day: 26, currentMonth: true, level: 1, time: '00:00' },
      { day: 27, currentMonth: true, level: 2, time: '00:00', selected: true },
      { day: 28, currentMonth: true, level: null, time: null },
      { day: 29, currentMonth: true, level: null, time: null },
      { day: 30, currentMonth: true, level: null, time: null },
      { day: 1, currentMonth: false, level: null, time: null },
      { day: 2, currentMonth: false, level: null, time: null },
      { day: 3, currentMonth: false, level: null, time: null }
    ],
    monthTotalText: 'abr.: 00H 02M'
  },
  summary: {
    totalStudyTime: 43, // in seconds
    maxConcentration: 19, // in seconds
    startTime: '2026-04-27T14:46:00',
    endTime: '2026-04-27T23:14:00',
    comparisonPreviousDay: -41, // in seconds
    chartBars: [24, 32, 28, 36, 40] // heights in pixels/units
  },
  distribution: {
    techniques: [
      { name: 'Shadow Technique', timeFormatted: '00:00', percentage: 100, color: '#E6676B' }
    ],
    categories: [
      { name: 'Estudio', timeFormatted: '00:00', percentage: 92, color: '#F97316' },
      { name: 'Descanso', timeFormatted: '00:00', percentage: 0, color: '#60A5FA' },
      { name: 'Otro', timeFormatted: '00:00', percentage: 8, color: '#9CA3AF' }
    ]
  },
  sessionDetail: {
    date: '2026-04-28',
    dateLabel: 'mar., 28 abr. 2026',
    totalTime: 25, // in seconds
    activityHeatmap: [
      1, 1, 1, 2, 2, 2, 2, 1, 1, 1,
      1, 2, 2, 2, 2, 2, 1, 1, 1, 1
    ] // 0: none, 1: light, 2: medium
  },
  history: [
    {
      type: 'range',
      timeRange: 'AM 5:00 ~ AM 11:55',
      duration: 24900 // 6h 55m in seconds
    },
    {
      type: 'session',
      time: 'AM 11:55',
      name: 'Shadow Technique',
      durationSeconds: 20,
      timeRange: 'AM 11:55 ~ AM 11:56'
    },
    {
      type: 'session',
      time: 'AM 11:56',
      name: 'Shadow Technique',
      durationSeconds: 4,
      timeRange: 'AM 11:56 ~ AM 11:56'
    },
    {
      type: 'range',
      timeRange: 'AM 11:56 ~ AM 5:00',
      duration: 61380 // 17h 3m in seconds
    }
  ]
};
