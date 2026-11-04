import { describe, it, expect } from 'vitest';
import { balanceReminderSchedule, isLateBooking } from '@/modules/email-voyage/domain/reminders';

const day = (iso: string) => new Date(`${iso}T10:00:00.000Z`);
const days = (list: { at: Date }[]) => list.map((r) => r.at.toISOString().slice(0, 10));

describe('balanceReminderSchedule', () => {
  it('J+2, puis un rappel par mois, puis dernier rappel 7 jours avant la date limite', () => {
    const confirmed = day('2027-01-10');
    const due = day('2027-04-20');
    const start = day('2027-06-20');
    const schedule = balanceReminderSchedule(confirmed, due, start);
    expect(days(schedule)).toEqual(['2027-01-12', '2027-02-10', '2027-03-10', '2027-04-13']);
    expect(schedule.map((r) => r.kind)).toEqual(['reminder', 'reminder', 'reminder', 'final']);
  });

  it("ancre mensuelle stable : fin de mois ramenée au dernier jour sans dériver", () => {
    const schedule = balanceReminderSchedule(day('2027-01-31'), day('2027-06-30'), day('2027-08-30'));
    expect(days(schedule)).toEqual(['2027-02-02', '2027-02-28', '2027-03-31', '2027-04-30', '2027-05-31', '2027-06-23']);
  });

  it('aucun rappel mensuel après la date limite ; le dernier rappel absorbe un mensuel trop proche', () => {
    const schedule = balanceReminderSchedule(day('2027-01-10'), day('2027-03-12'), day('2027-05-12'));
    expect(days(schedule)).toEqual(['2027-01-12', '2027-02-10', '2027-03-05']);
    expect(schedule.at(-1)?.kind).toBe('final');
  });

  it('conserve toujours le J+2 même proche du dernier rappel', () => {
    const schedule = balanceReminderSchedule(day('2027-01-10'), day('2027-01-20'), day('2027-03-20'));
    expect(days(schedule)).toEqual(['2027-01-12', '2027-01-13']);
  });

  it('un dernier rappel le même jour que le J+2 le remplace (un seul email par jour)', () => {
    const schedule = balanceReminderSchedule(day('2027-01-10'), day('2027-01-19'), day('2027-03-20'));
    expect(days(schedule)).toEqual(['2027-01-12']);
    expect(schedule[0]?.kind).toBe('final');
  });

  it('réservation tardive : solde exigible immédiatement, J+2 puis mensuel jusqu\'au départ, sans dernier rappel rétroactif', () => {
    const confirmed = day('2027-05-01');
    const due = new Date(confirmed.getTime() - 5); // échéance posée à la réservation
    const schedule = balanceReminderSchedule(confirmed, due, day('2027-07-15'));
    expect(days(schedule)).toEqual(['2027-05-03', '2027-06-01', '2027-07-01']);
    expect(schedule.every((r) => r.kind === 'reminder')).toBe(true);
  });

  it('aucun rappel si le départ est déjà passé ou immédiat', () => {
    expect(balanceReminderSchedule(day('2027-05-01'), day('2027-05-01'), day('2027-05-02'))).toEqual([]);
    expect(balanceReminderSchedule(day('2027-05-01'), day('2027-04-01'), day('2027-04-20'))).toEqual([]);
  });

  it('isLateBooking : échéance posée à la confirmation (tolérance 1 min)', () => {
    const confirmed = day('2027-05-01');
    expect(isLateBooking(confirmed, new Date(confirmed.getTime() + 30_000))).toBe(true);
    expect(isLateBooking(confirmed, new Date(confirmed.getTime() - 86_400_000))).toBe(true);
    expect(isLateBooking(confirmed, new Date(confirmed.getTime() + 86_400_000))).toBe(false);
  });
});
