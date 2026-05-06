import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';

LocaleConfig.locales['es'] = {
  monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr.', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mier', 'Jue', 'Vier', 'Sab'],
  today: 'Hoy'
};
LocaleConfig.defaultLocale = 'es';

export default function CalendarWidget({ calendarData }: any) {
  // Convert mock days array to a map for easy lookup
  const activityMap: Record<string, any> = {};
  calendarData.activityDays.forEach((d: any) => {
    if (d.date) {
      activityMap[d.date] = d;
    }
  });

  return (
    <View style={styles.card}>
      <Calendar
        current={calendarData.selectedDate}
        maxDate={new Date().toISOString().split('T')[0]}
        firstDay={1}
        hideExtraDays={true}
        monthFormat={'MMMM yyyy'}
        theme={{
          calendarBackground: '#ffffff',
          textSectionTitleColor: '#9CA3AF',
          selectedDayBackgroundColor: '#A594F9',
          selectedDayTextColor: '#ffffff',
          todayTextColor: '#A594F9',
          dayTextColor: '#374151',
          textDisabledColor: '#D1D5DB',
          arrowColor: '#9CA3AF',
          monthTextColor: '#374151',
          textDayFontWeight: '400',
          textMonthFontWeight: '700',
          textDayHeaderFontWeight: '400',
          textDayFontSize: 11,
          textMonthFontSize: 12,
          textDayHeaderFontSize: 10,
        }}
        dayComponent={({ date, state }: any) => {
          const dateStr = date.dateString;
          const dayData = activityMap[dateStr];
          const isSelected = dateStr === calendarData.selectedDate;
          const level = dayData?.level;
          const hasData = level !== undefined && level !== null;

          const textColor = hasData ? (level === 4 ? '#FFF' : getLegendTextColor(level)) : (state === 'disabled' ? '#D1D5DB' : '#374151');

          return (
            <View style={[
              styles.calendarCell,
              hasData && { backgroundColor: getLegendColor(level), borderRadius: 6 },
              isSelected && styles.calendarCellSelected
            ]}>
              <Text style={[
                styles.calendarCellText,
                { color: textColor }
              ]}>
                {date.day}
              </Text>
              {dayData?.time && (
                <Text style={[
                  styles.calendarCellTime,
                  { color: textColor }
                ]}>
                  {dayData.time}
                </Text>
              )}
            </View>
          );
        }}
      />
      
      <View style={styles.calendarFooter}>
        <View style={styles.calendarLegend}>
          {['0+', '4+', '7+', '10+', '12+'].map((l, i) => (
            <View key={i} style={[styles.legendBox, { backgroundColor: getLegendColor(i) }]}>
              <Text style={[styles.legendText, { color: i === 4 ? '#FFF' : getLegendTextColor(i) }]}>{l}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.calendarFooterText}>{calendarData.monthTotalText}</Text>
      </View>
    </View>
  );
}

function getLegendColor(index: number) {
  const colors = ['#F3F0FF', '#E0D4FC', '#C4AFFF', '#A58BFF', '#826BF0'];
  return colors[index] || colors[0];
}

function getLegendTextColor(index: number) {
  const colors = ['#A594F9', '#826BF0', '#7158E2', '#5E35B1', '#FFFFFF'];
  return colors[index] || colors[0];
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 2,
    marginBottom: 16,
    width: '100%',
  },
  calendarCell: {
    width: 36,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarCellSelected: {
    borderWidth: 1.5,
    borderColor: '#A594F9',
    borderRadius: 6,
  },
  calendarCellText: {
    fontSize: 11,
    color: '#374151',
  },
  calendarCellTime: {
    fontSize: 7,
    color: '#9CA3AF',
  },
  calendarFooter: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calendarLegend: {
    flexDirection: 'row',
    gap: 2,
  },
  legendBox: {
    paddingHorizontal: 2,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 8,
  },
  calendarFooterText: {
    fontSize: 8,
    color: '#9CA3AF',
  },
});
