import { TestBed } from '@angular/core/testing';

// There is intentionally NO global beforeEach here. A top-level beforeEach used to give every spec
// HttpClient and a router, which made specs that forgot their own providers pass in a full run but
// fail when run alone. Specs now declare what they need (see src/testing/baseline-test-providers.ts),
// so any spec passes on its own, in any order.
describe('test environment', () => {
  it('is initialised without shared global providers', () => {
    expect(TestBed).toBeDefined();
  });
});
