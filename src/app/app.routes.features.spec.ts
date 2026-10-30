import { Route } from '@angular/router';
import { routes } from './app.routes';
import { featureGuard } from './auth/feature.guard';
import { FEATURES } from './auth/feature-keys';

/** Route-level plan feature guards: every key is a catalog key, and the Classroom, event
 *  calendar and subject routes carry the intended feature. The backend enforces the same. */
describe('Routes — plan feature guards', () => {
  const dashboard = routes.find(r => r.path === 'dashboard')!;
  const route = (path: string): Route => dashboard.children!.find(r => r.path === path)!;
  const known = Object.values(FEATURES) as string[];

  it('every featureKey on a route is a known catalog key, and always comes with the feature guard', () => {
    for (const r of dashboard.children!) {
      const key = r.data?.['featureKey'];
      if (!key) continue;
      expect(known).withContext(r.path!).toContain(key);
      expect(r.canActivate).withContext(r.path!).toContain(featureGuard);
    }
  });

  it('Homework, Class Updates and Assessments — student, parent and teacher pages — need Classroom', () => {
    for (const path of ['homework', 'class-updates', 'assessments', 'homework-classwork', 'teacher-class-updates', 'manage-assessments']) {
      expect(route(path).canActivate).withContext(path).toContain(featureGuard);
      expect(route(path).data!['featureKey']).withContext(path).toBe(FEATURES.CLASSROOM);
    }
  });

  it('the event calendar pages carry the (core) School Communication guard', () => {
    for (const path of ['event-calendar', 'event-new', 'event-edit/:id']) {
      expect(route(path).canActivate).withContext(path).toContain(featureGuard);
      expect(route(path).data!['featureKey']).withContext(path).toBe(FEATURES.SCHOOL_COMMUNICATION);
    }
  });

  it('class subjects are core; Thought of the Day management needs its feature', () => {
    expect(route('subject-config').data!['featureKey']).toBe(FEATURES.SCHOOL_ADMINISTRATION);
    expect(route('wisdom/manage').data!['featureKey']).toBe(FEATURES.THOUGHT_OF_THE_DAY);
    expect(route('student-promotion').data!['featureKey']).toBe(FEATURES.SCHOOL_ADMINISTRATION);
  });
});
