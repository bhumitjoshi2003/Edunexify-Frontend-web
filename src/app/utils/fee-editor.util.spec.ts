import { feeRuleWrite } from './fee-editor.util';
describe('shared fee rule version policy',()=>{const session={id:1,startDate:'2026-10-01',endDate:'2027-09-30'} as any;const row={feeHeadId:1,academicSessionId:1,className:'A',amount:100,effectiveFrom:'2026-10-01'};
 it('first rules start at the session even when configured later',()=>expect(feeRuleWrite([row],[],session,'A','','2026-10-19')[0].effectiveFrom).toBe('2026-10-01'));
 it('unchanged rules preserve their version',()=>expect(feeRuleWrite([row],[row],session,'A','','2026-10-19')[0].effectiveFrom).toBe('2026-10-01'));
 for(const date of ['', '2026-10-01','2026-10-18','2027-10-01'])it('rejects an invalid forward date '+date,()=>expect(()=>feeRuleWrite([{...row,amount:200}],[row],session,'A',date,'2026-10-19')).toThrow());
 it('changed amounts use a deliberate future date',()=>expect(feeRuleWrite([{...row,amount:200}],[row],session,'A','2026-11-01','2026-10-19')[0].effectiveFrom).toBe('2026-11-01'));
});
