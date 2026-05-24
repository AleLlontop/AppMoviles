import dayjs from 'dayjs';
import 'dayjs/locale/es';

dayjs.locale('es');

export const adaptStatisticsData = (
  rawData: any,
  targetDateString: string,
  periodType: 'day' | 'week' | 'month' = 'month'
) => {
  const { sessions } = rawData;
  const targetDate = dayjs(targetDateString);

  // 1. Calendar — always shows the month of the target date
  const dailyDurations: Record<string, number> = {};
  sessions.forEach((s: any) => {
    const day = dayjs(s.start_time).format('YYYY-MM-DD');
    dailyDurations[day] = (dailyDurations[day] || 0) + (s.duration || 0);
  });

  const activityDays = [];
  const calendarMonth = targetDate;
  const daysInMonth = calendarMonth.daysInMonth();

  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = calendarMonth.date(i).format('YYYY-MM-DD');
    const dur = dailyDurations[dateStr] || 0;

    let level = null;
    let time = null;
    if (dur > 0) {
      const hours = dur / 3600;
      if (hours >= 12) level = 4;
      else if (hours >= 10) level = 3;
      else if (hours >= 7) level = 2;
      else if (hours >= 4) level = 1;
      else level = 0;

      const hh = Math.floor(hours).toString().padStart(2, '0');
      const mm = Math.floor((dur % 3600) / 60).toString().padStart(2, '0');
      time = `${hh}:${mm}`;
    }

    activityDays.push({
      date: dateStr,
      day: i,
      currentMonth: true,
      level,
      time,
      selected: dateStr === targetDateString,
    });
  }

  const totalMonthSeconds = Object.values(dailyDurations).reduce((a, b) => a + b, 0);
  const monthLabel = calendarMonth.format('MMM.').toLowerCase();
  const monthHours = Math.floor(totalMonthSeconds / 3600).toString().padStart(2, '0');
  const monthMins = Math.floor((totalMonthSeconds % 3600) / 60).toString().padStart(2, '0');
  const monthTotalText = `${monthLabel}: ${monthHours}H ${monthMins}M`;

  // 2. Summary — filtered to target period
  const periodSessions = sessions; // already filtered by date range from service
  const totalStudyTime = periodSessions.reduce((sum: number, s: any) => sum + (s.duration || 0), 0);

  const maxConcentration = periodSessions.length > 0
    ? periodSessions.reduce((max: number, s: any) => Math.max(max, s.duration || 0), 0)
    : 0;

  const sortedSessions = [...periodSessions].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
  const startTime = sortedSessions.length > 0
    ? sortedSessions[0].start_time
    : targetDate.startOf('day').toISOString();
  const endTime = sortedSessions.length > 0
    ? sortedSessions[sortedSessions.length - 1].end_time || sortedSessions[sortedSessions.length - 1].start_time
    : targetDate.endOf('day').toISOString();

  // chartBars: 8 two-hour buckets from 6am to 10pm
  const buckets = new Array(8).fill(0);
  periodSessions.forEach((s: any) => {
    const hour = dayjs(s.start_time).hour();
    // bucket index: 0=6-8h, 1=8-10h, ... 7=20-22h; clamp to range
    const bucketIdx = Math.max(0, Math.min(7, Math.floor((hour - 6) / 2)));
    buckets[bucketIdx] += (s.duration || 0);
  });
  // Normalize to 0-50 range for the chart
  const maxBucket = Math.max(...buckets, 1);
  const chartBars = buckets.map(v => Math.round((v / maxBucket) * 50));

  // 3. Distribution — all sessions in the period
  const techMap: Record<string, { time: number; color: string }> = {};
  const catMap: Record<string, { time: number; color: string; label: string }> = {
    study: { time: 0, color: '#F97316', label: 'Study' },
    break: { time: 0, color: '#60A5FA', label: 'Break' },
    other: { time: 0, color: '#9CA3AF', label: 'Other' },
  };

  periodSessions.forEach((s: any) => {
    const duration = s.duration || 0;
    const groupKey = s.techniques?.name || s.subjects?.name || 'No category';
    const groupColor = s.techniques?.color || s.subjects?.color || '#A594F9';

    if (!techMap[groupKey]) {
      techMap[groupKey] = { time: 0, color: groupColor };
    }
    techMap[groupKey].time += duration;

    // All sessions count as study (no segment data yet)
    catMap.study.time += duration;
  });

  const totalTechTime = Object.values(techMap).reduce((sum, t) => sum + t.time, 0) || 1;
  const totalCatTime = catMap.study.time + catMap.break.time + catMap.other.time || 1;

  const distribution = {
    techniques: Object.entries(techMap).map(([name, data]) => ({
      name,
      timeFormatted: formatHMS(data.time),
      percentage: Math.round((data.time / totalTechTime) * 100),
      color: data.color,
    })),
    categories: Object.entries(catMap)
      .filter(([, data]) => data.time > 0)
      .map(([, data]) => ({
        name: data.label,
        timeFormatted: formatHMS(data.time),
        percentage: Math.round((data.time / totalCatTime) * 100),
        color: data.color,
      })),
  };

  // 4. Session Detail (for the target day)
  const sessionDetail = {
    date: targetDateString,
    dateLabel: targetDate.format('ddd., D MMM. YYYY'),
    totalTime: totalStudyTime,
    activityHeatmap: buckets.map(v => (v > 0 ? 2 : 0)),
  };

  // 5. History
  const history: any[] = periodSessions.map((s: any) => ({
    type: 'session',
    time: dayjs(s.start_time).format('HH:mm'),
    name: s.techniques?.name || s.subjects?.name || 'Sesión',
    color: s.techniques?.color || s.subjects?.color || '#A594F9',
    durationSeconds: s.duration || 0,
    timeRange: `${dayjs(s.start_time).format('HH:mm')} ~ ${dayjs(s.end_time || s.start_time).format('HH:mm')}`,
  }));

  return {
    calendar: {
      currentMonth: monthLabel,
      selectedDate: targetDateString,
      activityDays,
      monthTotalText,
    },
    summary: {
      totalStudyTime,
      maxConcentration,
      startTime,
      endTime,
      comparisonPreviousDay: 0,
      chartBars,
      dateLabel: targetDate.format('ddd., D MMM.'),
    },
    distribution,
    sessionDetail,
    history,
  };
};

function formatHMS(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
