import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('legacy HR model imports use canonical instances without losing other modules', async () => {
  const models = await import('../models/index.js');
  const {Employee} = await import('../models/employeeModel.js');
  const {User} = await import('../models/userModel.js');
  const {PayrollItem} = await import('../models/payrollItemModel.js');
  assert.equal(Employee, models.Employee);
  assert.equal(User, models.User);
  assert.equal(PayrollItem, models.PayrollItem);
  assert.equal(models.sequelize.models.Employee, Employee);
  assert.equal(models.sequelize.models.employees, undefined);
  for (const name of ['Product','StockMovement','Order','OrderItem','ProductReview','JournalEntry','SalaryRelease','Remittance','Department','LeaveRequest','PayrollRun']) assert.ok(models[name], name);
  assert.ok(models.Order.associations.DeliveredBy);
  assert.ok(models.LeaveRequest.rawAttributes.decision_remarks);
  assert.ok(PayrollItem.rawAttributes.overtime_minutes);
  assert.ok(PayrollItem.rawAttributes.overtime_pay);
});

test('sync updates all five module copies and preserves HR local adapters and layout', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(),'mindafresh-sync-'));
  await fs.writeFile(
  path.join(tmp, "package.json"),
  JSON.stringify({ private: true, type: "module" }),
  );
  try {
    await fs.cp(path.join(root,'shared'), path.join(tmp,'shared'), {recursive:true});
    const modules=['shop','pos','attendance','hr','accounting'];
    for(const mod of modules) await fs.mkdir(path.join(tmp,mod));
    const protectedPaths=['services/hrAuthService.js','views/partials/hr-head.xian','views/partials/hr-footer.xian','views/partials/pages/leaves.xian'];
    for(const rel of protectedPaths) {
      const dest=path.join(tmp,'hr',rel);
      await fs.mkdir(path.dirname(dest),{recursive:true});
      await fs.copyFile(path.join(root,'hr',rel),dest);
    }
    execFileSync(process.execPath,[path.join(tmp,'shared/sync.js')]);
    for(const mod of modules) {
      for(const rel of ['models/index.js','models/PayrollItem.js','models/LeaveRequest.js']) {
        assert.deepEqual(await fs.readFile(path.join(tmp,mod,rel)),await fs.readFile(path.join(tmp,'shared',rel)));
      }
    }
    for(const rel of protectedPaths) assert.deepEqual(await fs.readFile(path.join(tmp,'hr',rel)),await fs.readFile(path.join(root,'hr',rel)));
    const second=execFileSync(process.execPath,[path.join(tmp,'shared/sync.js')],{encoding:'utf8'});
    assert.equal((second.match(/up to date/g)||[]).length,5);
  } finally { await fs.rm(tmp,{recursive:true,force:true}); }
});
