export type TeacherTodayClassStatus = 'current' | 'upcoming' | 'done' | 'scheduled';

export interface TeacherTimetableEntryLike {
  id?: number;
  day: string;
  className: string;
  sectionName?: string | null;
  subjectName: string;
  periodNumber: number;
  startTime?: string | null;
  endTime?: string | null;
  isSubstitution?: boolean;
  originalTeacherName?: string | null;
  substitutionNote?: string | null;
  /** The real timetable entry id (a covered period's entry for substitutions). */
  timetableEntryId?: number | null;
}

export interface TeacherTodayClassEntry {
  key: string;
  className: string;
  sectionName: string | null;
  subjectName: string;
  periodNumber: number;
  startTime: string | null;
  endTime: string | null;
  status: TeacherTodayClassStatus;
  isSubstitution: boolean;
  originalTeacherName: string | null;
  substitutionNote: string | null;
  timetableEntryId: number | null;
}

export interface TeacherTodayClassesView {
  current: TeacherTodayClassEntry | null;
  upcoming: TeacherTodayClassEntry[];
  allDone: boolean;
  hasAnyToday: boolean;
}

const DAY_CODES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export function todayDayCode(date: Date): string {
  return DAY_CODES[date.getDay()];
}

function minutesSinceMidnight(time: string | null | undefined): number | null {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(time.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function buildTodayClasses(
  entries: TeacherTimetableEntryLike[],
  now: Date
): TeacherTodayClassEntry[] {
  const day = todayDayCode(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return entries
    .filter(entry => entry.day === day)
    .map((entry, index) => {
      const start = minutesSinceMidnight(entry.startTime);
      const end = minutesSinceMidnight(entry.endTime);
      let status: TeacherTodayClassStatus;
      if (start === null || end === null) status = 'scheduled';
      else if (start <= nowMinutes && nowMinutes < end) status = 'current';
      else if (end <= nowMinutes) status = 'done';
      else status = 'upcoming';

      return {
        key: entry.id != null ? String(entry.id) : `${entry.periodNumber}-${index}`,
        className: entry.className,
        sectionName: entry.sectionName ?? null,
        subjectName: entry.subjectName,
        periodNumber: entry.periodNumber,
        startTime: start !== null ? entry.startTime! : null,
        endTime: end !== null ? entry.endTime! : null,
        status,
        isSubstitution: !!entry.isSubstitution,
        originalTeacherName: entry.originalTeacherName ?? null,
        substitutionNote: entry.substitutionNote ?? null,
        timetableEntryId: entry.timetableEntryId
          ?? (entry.id != null && entry.id > 0 && !entry.isSubstitution ? entry.id : null),
        sortMinutes: start,
      };
    })
    .sort((a, b) => {
      if (a.sortMinutes !== null && b.sortMinutes !== null) return a.sortMinutes - b.sortMinutes;
      if (a.sortMinutes !== null) return -1;
      if (b.sortMinutes !== null) return 1;
      return a.periodNumber - b.periodNumber;
    })
    .map(({ sortMinutes, ...entry }) => entry);
}

export function buildTodayClassesView(
  entries: TeacherTimetableEntryLike[],
  now: Date,
  visibleLimit = 3
): TeacherTodayClassesView {
  const today = buildTodayClasses(entries, now);
  const current = today.find(entry => entry.status === 'current') ?? null;
  // A cover assignment follows the same visibility rule as any other period — once its
  // time has passed it's 'done' and drops off Today's Classes, it does not linger.
  const pending = today.filter(entry => entry.status === 'upcoming' || entry.status === 'scheduled');
  const upcoming = pending.slice(0, Math.max(0, visibleLimit - (current ? 1 : 0)));
  return {
    current,
    upcoming,
    allDone: today.length > 0 && !current && pending.length === 0,
    hasAnyToday: today.length > 0,
  };
}
