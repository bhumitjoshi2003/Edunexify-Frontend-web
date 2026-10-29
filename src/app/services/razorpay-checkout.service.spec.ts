import { RazorpayCheckoutService, RazorpayCheckoutUnavailableError, RAZORPAY_CHECKOUT_SRC, RAZORPAY_SCRIPT_ID } from './razorpay-checkout.service';

/** Shared by the web and Android clients — keep the two copies identical. No real network. */
describe('RazorpayCheckoutService', () => {
  class FakeScript {
    id = '';
    src = '';
    async = false;
    removed = false;
    private attrs: Record<string, string> = {};
    private listeners: Record<string, Array<() => void>> = {};
    constructor(private doc: FakeDocument) {}
    addEventListener(event: string, cb: () => void) { (this.listeners[event] ??= []).push(cb); }
    removeEventListener(event: string, cb: () => void) { this.listeners[event] = (this.listeners[event] ?? []).filter((x) => x !== cb); }
    setAttribute(k: string, v: string) { this.attrs[k] = v; }
    getAttribute(k: string) { return this.attrs[k] ?? null; }
    remove() { this.removed = true; this.doc.scripts = this.doc.scripts.filter((s) => s !== this); }
    fire(event: string) { [...(this.listeners[event] ?? [])].forEach((cb) => cb()); }
  }
  class FakeDocument {
    scripts: FakeScript[] = [];
    created: FakeScript[] = [];
    defaultView: any = {};
    body = { appendChild: (s: FakeScript) => { this.scripts.push(s); } };
    createElement() { const s = new FakeScript(this); this.created.push(s); return s; }
    getElementById(id: string) { return this.scripts.find((s) => s.id === id) ?? null; }
  }

  let doc: FakeDocument;
  let service: RazorpayCheckoutService;
  const Ctor = function Razorpay() {} as any;

  beforeEach(() => {
    doc = new FakeDocument();
    service = new RazorpayCheckoutService(doc as any);
  });

  it('returns the global immediately when the script is already there', async () => {
    doc.defaultView.Razorpay = Ctor;
    await expectAsync(service.load()).toBeResolvedTo(Ctor);
    expect(doc.created.length).toBe(0);
  });

  it('injects the script once for concurrent callers and resolves when it defines window.Razorpay', async () => {
    const a = service.load();
    const b = service.load();
    expect(doc.created.length).toBe(1);
    expect(doc.created[0].id).toBe(RAZORPAY_SCRIPT_ID);
    expect(doc.created[0].src).toBe(RAZORPAY_CHECKOUT_SRC);
    doc.defaultView.Razorpay = Ctor;
    doc.created[0].fire('load');
    await expectAsync(a).toBeResolvedTo(Ctor);
    await expectAsync(b).toBeResolvedTo(Ctor);
  });

  it('a script error rejects, removes the tag, and the next load retries with a fresh tag', async () => {
    const first = service.load();
    doc.created[0].fire('error');
    await expectAsync(first).toBeRejectedWith(jasmine.objectContaining({ reason: 'error' }));
    expect(doc.created[0].removed).toBeTrue();

    const second = service.load();
    expect(doc.created.length).toBe(2);
    doc.defaultView.Razorpay = Ctor;
    doc.created[1].fire('load');
    await expectAsync(second).toBeResolvedTo(Ctor);
  });

  it('a script that loads without defining the global is a failure', async () => {
    const attempt = service.load();
    doc.created[0].fire('load');
    const error = await attempt.catch((e) => e);
    expect(error instanceof RazorpayCheckoutUnavailableError).toBeTrue();
    expect(error.reason).toBe('missing-global');
  });

  it('a slow or blocked CDN times out instead of hanging, and can be retried', async () => {
    jasmine.clock().install();
    try {
      const attempt = service.load(1000);
      jasmine.clock().tick(1001);
      await expectAsync(attempt).toBeRejectedWith(jasmine.objectContaining({ reason: 'timeout' }));
      expect(doc.scripts.length).toBe(0);
      service.load(1000);
      expect(doc.created.length).toBe(2);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('no document (server-side rendering) rejects', async () => {
    const ssr = new RazorpayCheckoutService(null as any);
    await expectAsync(ssr.load()).toBeRejectedWith(jasmine.objectContaining({ reason: 'no-document' }));
  });
});
