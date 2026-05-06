import dayjs from 'dayjs';
import 'dayjs/locale/es';

dayjs.locale('es');

export const adaptStatisticsData = (rawData: any, targetDateString: string) => {
  const { subjects, techniques, sessions, segments } = rawData;
  const targetDate = dayjs(targetDateString);
  const currentMonth = targetDate.format('MMM.').toLowerCase();

  // 1. Calendar
  const dailyDurations: Record<string, number> = {};
  sessions.forEach((s: any) => {
    const day = dayjs(s.start_time).format('YYYY-MM-DD');
    dailyDurations[day] = (dailyDurations[day] || 0) + (s.duration || 0);
  });

  const activityDays = [];
  const daysInMonth = targetDate.daysInMonth();
  
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = targetDate.date(i).format('YYYY-MM-DD');
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
      
      time = `${Math.floor(hours).toString().padStart(2, '0')}:${Math.floor((dur % 3600) / 60).toString().padStart(2, '0')}`;
    }
    
    activityDays.push({
      date: dateStr,
      day: i,
      currentMonth: true,
      level,
      time,
      selected: dateStr === targetDateString
    });
  }

  const totalMonthSeconds = Object.values(dailyDurations).reduce((a, b) => a + b, 0);
  const monthHours = Math.floor(totalMonthSeconds / 3600).toString().padStart(2, '0');
  const monthMins = Math.floor((totalMonthSeconds % 3600) / 60).toString().padStart(2, '0');
  const monthTotalText = `${currentMonth}: ${monthHours}H ${monthMins}M`;

  // 2. Summary
  const daySessions = sessions.filter((s: any) => dayjs(s.start_time).isSame(targetDate, 'day'));
  const totalStudyTime = daySessions.reduce((sum: number, s: any) => sum + (s.duration || 0), 0);
  
  const daySegments = segments.filter((seg: any) => daySessions.some((s: any) => s.id === seg.session_id));
  const maxConcentration = daySegments.length > 0
    ? daySegments.filter((s: any) => s.type === 'study').reduce((max: number, s: any) => Math.max(max, s.duration || 0), 0)
    : daySessions.reduce((max: number, s: any) => Math.max(max, s.duration || 0), 0);

  const startTime = daySessions.length > 0 ? daySessions[0].start_time : targetDate.startOf('day').toISOString();
  const endTime = daySessions.length > 0 ? daySessions[daySessions.length - 1].end_time : targetDate.endOf('day').toISOString();
  
  const chartBars = [24, 32, 28, 36, 40]; 

  // 3. Distribution
  const techMap: Record<string, { time: number; color: string }> = {};
  const catMap: Record<string, { time: number; color: string }> = {
    Estudio: { time: 0, color: '#F97316' },
    Descanso: { time: 0, color: '#60A5FA' },
    Otro: { time: 0, color: '#9CA3AF' }
  };

  daySessions.forEach((s: any) => {
    // Populate techMap with techniques, fallback to subjects
    if (s.techniques) {
      if (!techMap[s.techniques.name]) {
        techMap[s.techniques.name] = { time: 0, color: s.techniques.color };
      }
      techMap[s.techniques.name].time += s.duration || 0;
    } else if (s.subjects) {
      if (!techMap[s.subjects.name]) {
        techMap[s.subjects.name] = { time: 0, color: s.subjects.color || '#A594F9' };
      }
      techMap[s.subjects.name].time += s.duration || 0;
    }
  });

  if (daySegments.length > 0) {
    daySegments.forEach((seg: any) => {
      if (seg.type === 'study') catMap.Estudio.time += (seg.duration || 0);
      else if (seg.type === 'break') catMap.Descanso.time += (seg.duration || 0);
      else catMap.Otro.time += (seg.duration || 0);
    });
  } else {
    // Fallback: all session time is 'Estudio'
    daySessions.forEach((s: any) => {
      catMap.Estudio.time += (s.duration || 0);
    });
  }

  const totalCatTime = catMap.Estudio.time + catMap.Descanso.time + catMap.Otro.time || 1; 
  const totalTechTime = Object.values(techMap).reduce((sum, t) => sum + t.time, 0) || 1;

  const distribution = {
    techniques: Object.entries(techMap).map(([name, data]) => ({
      name,
      timeFormatted: `${Math.floor(data.time / 3600).toString().padStart(2, '0')}:${Math.floor((data.time % 3600) / 60).toString().padStart(2, '0')}`,
      percentage: Math.round((data.time / totalTechTime) * 100),
      color: data.color
    })),
    categories: Object.entries(catMap).map(([name, data]) => ({
      name,
      timeFormatted: `${Math.floor(data.time / 3600).toString().padStart(2, '0')}:${Math.floor((data.time % 3600) / 60).toString().padStart(2, '0')}`,
      percentage: Math.round((data.time / totalCatTime) * 100),
      color: data.color
    }))
  };

  // 4. Session Detail
  const sessionDetail = {
    date: targetDateString,
    dateLabel: targetDate.format('ddd., D MMM. YYYY'),
    totalTime: totalStudyTime,
    activityHeatmap: [1, 1, 1, 2, 2, 2, 2, 1, 1, 1, 1, 2, 2, 2, 2, 2, 1, 1, 1, 1] 
  };

  // 5. History
  const history: any[] = [];
  daySessions.forEach((s: any) => {
    history.push({
      type: 'session',
      time: dayjs(s.start_time).format('A h:mm'),
      name: s.techniques ? s.techniques.name : (s.subjects ? s.subjects.name : 'Sesión'),
      color: s.techniques ? s.techniques.color : (s.subjects ? s.subjects.color : '#A594F9'),
      durationSeconds: s.duration,
      timeRange: `${dayjs(s.start_time).format('A h:mm')} ~ ${dayjs(s.end_time).format('A h:mm')}`
    });
  });

  return {
    calendar: {
      currentMonth,
      selectedDate: targetDateString,
      activityDays,
      monthTotalText
    },
    summary: {
      totalStudyTime,
      maxConcentration,
      startTime,
      endTime,
      comparisonPreviousDay: 0,
      chartBars
    },
    distribution,
    sessionDetail,
    history
  };
};
