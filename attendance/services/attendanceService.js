import { QueryTypes, Transaction } from 'sequelize';
import { db } from '../storage.js';
const q=(sql,replacements={},transaction)=>db.query(sql,{replacements,type:QueryTypes.SELECT,transaction});
const exec=(sql,replacements={},transaction)=>db.query(sql,{replacements,transaction});
const pad=n=>String(n).padStart(2,'0');
export const dateKey=(d=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const clock=d=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d);
const localStamp=d=>`${dateKey(d)} ${clock(d)}:${new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Manila',second:'2-digit'}).format(d)}`;
const localMinutes=d=>minutes(clock(d));
const minutes=s=>{const [h,m]=s.split(':').map(Number);return h*60+m};
export const workday=d=>process.env.WORK_DAYS?.split(',').map(Number).includes((new Date(`${d}T12:00:00`).getDay()+6)%7+1)??true;
export const metrics=(a,b)=>{if(!a||!b)return {hours_worked:0,undertime_minutes:0};const toLocal=v=>{if(v instanceof Date)return new Date(v.getTime());return new Date(String(v).replace(' ','T')+'+08:00')};const begin=toLocal(a),end=toLocal(b);const ms=Math.max(0,(end-begin)/60000);return {hours_worked:Math.min(8,Math.max(0,(ms-60)/60)).toFixed(2),undertime_minutes:Math.max(0,minutes(process.env.SHIFT_END||'17:00')-localMinutes(end))}};
export const nextAction=log=>!log?'Time in':!log.lunch_out?'Lunch out':!log.lunch_in?'Lunch in':!log.time_out?'Time out':'Complete';
export async function lookup(code){return (await q('SELECT id,employee_code,first_name,last_name,status FROM employees WHERE employee_code=:code',{code}))[0]}
export async function getLog(employee_id,date=dateKey()){return (await q('SELECT * FROM attendance_logs WHERE employee_id=:employee_id AND log_date=:date',{employee_id,date}))[0]}
export async function punch(code){const employee=await lookup(code);if(!employee||employee.status!=='active')throw Error('Unknown or inactive employee code.');const date=dateKey();if(!workday(date))throw Error('No time-in on rest days.');if((await q('SELECT id FROM holidays WHERE holiday_date=:date',{date})).length)throw Error('Punches are not allowed on holidays.');return db.transaction(async transaction=>{const rows=await q('SELECT * FROM attendance_logs WHERE employee_id=:id AND log_date=:date FOR UPDATE',{id:employee.id,date},transaction);const log=rows[0],action=nextAction(log);if(action==='Complete')throw Error('You already timed out today.');const now=new Date();const stamp=localStamp(now);const last=log&&[log.time_out,log.lunch_in,log.lunch_out,log.time_in].find(Boolean);if(last&&(now-new Date(last instanceof Date ? last : String(last).replace(' ','T')+'+08:00'))<60000)throw Error('Please wait at least one minute before punching again.');if(!log){const late=Math.max(0,localMinutes(now)-minutes(process.env.SHIFT_START||'08:00'));await exec('INSERT INTO attendance_logs (employee_id,log_date,time_in,late_minutes,status) VALUES (:id,:date,:stamp,:late,:status)',{id:employee.id,date,stamp,late,status:late?'late':'present'},transaction);await exec('UPDATE attendance_logs SET log_code=CONCAT("ATT-",LPAD(id,4,"0")) WHERE employee_id=:employee_id AND log_date=:date AND log_code IS NULL',{employee_id:employee.id,date},transaction)}else if(action==='Lunch out')await exec('UPDATE attendance_logs SET lunch_out=:stamp WHERE id=:id',{stamp,id:log.id},transaction);else if(action==='Lunch in')await exec('UPDATE attendance_logs SET lunch_in=:stamp WHERE id=:id',{stamp,id:log.id},transaction);else{const m=metrics(log.time_in,now);await exec('UPDATE attendance_logs SET time_out=:stamp,hours_worked=:hours_worked,undertime_minutes=:undertime_minutes WHERE id=:id',{stamp,id:log.id,...m},transaction)}return {name:`${employee.first_name} ${employee.last_name}`,action,time:clock(now)};});}
export async function today(date=dateKey()){const employees=await q(`SELECT e.employee_code,CONCAT(e.first_name,' ',e.last_name) name,d.name department,l.* FROM employees e LEFT JOIN departments d ON d.id=e.department_id LEFT JOIN attendance_logs l ON l.employee_id=e.id AND l.log_date=:date WHERE e.status='active' ORDER BY e.last_name`,{date});return employees.map(e=>({...e,display_status:e.status&&e.log_date?e.status:'not_yet_in'}));}
export async function logs(from,to){return q(`SELECT l.*,e.employee_code,CONCAT(e.first_name,' ',e.last_name) name FROM attendance_logs l JOIN employees e ON e.id=l.employee_id WHERE l.log_date BETWEEN :from AND :to ORDER BY l.log_date DESC,e.last_name`,{from,to})}
export async function getSummary(from,to){return q(`SELECT e.id employee_id,e.employee_code,CONCAT(e.first_name,' ',e.last_name) employee_name,COALESCE(SUM(l.status='present'),0) days_present,COALESCE(SUM(l.status='late'),0) days_late,COALESCE(SUM(l.status='absent'),0) days_absent,COALESCE(SUM(l.status='on_leave'),0) days_on_leave,COALESCE(SUM(l.late_minutes),0) total_late_minutes,COALESCE(SUM(l.undertime_minutes),0) total_undertime_minutes,COALESCE(ROUND(SUM(l.hours_worked),2),0) total_hours_worked FROM employees e LEFT JOIN attendance_logs l ON l.employee_id=e.id AND l.log_date BETWEEN :from AND :to WHERE e.status='active' GROUP BY e.id ORDER BY e.last_name`,{from,to})}
export async function closeDays(from,to){
 validateRange(from,to);
 let created=0;
 for(let d=new Date(`${from}T12:00:00`);dateKey(d)<=to;d.setDate(d.getDate()+1)){
  const date=dateKey(d);
  if(date>=dateKey()||!workday(date)||(await q('SELECT id FROM holidays WHERE holiday_date=:date',{date})).length)continue;
  const people=await q(`SELECT e.id,CASE WHEN EXISTS(SELECT 1 FROM leave_requests r WHERE r.employee_id=e.id AND r.status='approved' AND :date BETWEEN r.start_date AND r.end_date) THEN 'on_leave' ELSE 'absent' END status FROM employees e WHERE e.status='active'`,{date});
  for(const p of people){
   await db.transaction(async transaction=>{
    const existing=await q('SELECT id FROM attendance_logs WHERE employee_id=:employee_id AND log_date=:date',{employee_id:p.id,date},transaction);
    if(existing.length)return;
    const [insertResult]=await exec('INSERT IGNORE INTO attendance_logs (employee_id,log_date,status) VALUES (:employee_id,:date,:status)',{employee_id:p.id,date,status:p.status},transaction);
    const wasInserted=Number(insertResult?.affectedRows||0)===1;
    const inserted=await q('SELECT id,log_code FROM attendance_logs WHERE employee_id=:employee_id AND log_date=:date',{employee_id:p.id,date},transaction);
    if(inserted.length){
     if(!inserted[0].log_code)await exec('UPDATE attendance_logs SET log_code=CONCAT("ATT-",LPAD(id,4,"0")) WHERE id=:id',{id:inserted[0].id},transaction);
     if(wasInserted)created++;
    }
   });
  }
 }
 return created;
}
export async function correct(id,body,actor){
 if(!body.remarks?.trim())throw Error('Correction remarks are required.');
 if(!['present','late','absent','on_leave'].includes(body.status))throw Error('Invalid status.');
 const log=(await q('SELECT * FROM attendance_logs WHERE id=:id',{id}))[0];if(!log)throw Error('Log not found.');
 const values={};for(const field of ['time_in','lunch_out','lunch_in','time_out']){
   const raw=body[field];values[field]=raw?raw.replace('T',' ')+(raw.length===16?':00':''):null;
   if(values[field]&&!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(values[field]))throw Error('Invalid time format.');
 }
 if(values.lunch_in&&!values.lunch_out)throw Error('Lunch in requires lunch out.');
 if(values.lunch_out&&!values.time_in)throw Error('Lunch out requires time in.');
 if(values.time_out&&!values.time_in)throw Error('Time out requires time in.');
 const times=['time_in','lunch_out','lunch_in','time_out'].map(k=>values[k]).filter(Boolean);
 if(times.some((v,i)=>i&&v<times[i-1]))throw Error('Punch times must be in chronological order.');
 if(times.some(v=>v.slice(0,10)!==dateKey(new Date(String(log.log_date).slice(0,10)+'T12:00:00'))))throw Error('Punch date must match attendance date.');
 if(['absent','on_leave'].includes(body.status)&&times.length)throw Error('Absent/on-leave logs cannot have punches.');
 const m=metrics(values.time_in,values.time_out);
 const late=values.time_in?Math.max(0,minutes(values.time_in.slice(11,16))-minutes(process.env.SHIFT_START||'08:00')):0;
 await exec(`UPDATE attendance_logs SET time_in=:time_in,lunch_out=:lunch_out,lunch_in=:lunch_in,time_out=:time_out,status=:status,remarks=:remarks,corrected_by_id=:actor,late_minutes=:late,hours_worked=:hours_worked,undertime_minutes=:undertime_minutes WHERE id=:id`,{id,actor,status:body.status,remarks:body.remarks.trim(),late,...m,...values});
}
export function validateRange(from,to){if(!/^\d{4}-\d{2}-\d{2}$/.test(from||'')||!/^\d{4}-\d{2}-\d{2}$/.test(to||'')||from>to)throw Error('Invalid date range.');const days=(new Date(to+'T12:00:00')-new Date(from+'T12:00:00'))/86400000;if(days>366)throw Error('Date range must be 366 days or less.');}
export async function holidays(){return q('SELECT * FROM holidays ORDER BY holiday_date DESC')}
export async function addHoliday(body){if(!['regular','special'].includes(body.holiday_type))throw Error('Invalid holiday type.');await exec('INSERT INTO holidays(holiday_date,name,holiday_type) VALUES (:holiday_date,:name,:holiday_type)',body)}
export async function removeHoliday(id){await exec('DELETE FROM holidays WHERE id=:id',{id})}

export async function editHoliday(id,body){if(!/^\d{4}-\d{2}-\d{2}$/.test(body.holiday_date||'')||!body.name?.trim()||!['regular','special'].includes(body.holiday_type))throw Error('Invalid holiday details.');await exec('UPDATE holidays SET holiday_date=:holiday_date,name=:name,holiday_type=:holiday_type WHERE id=:id',{id,holiday_date:body.holiday_date,name:body.name.trim(),holiday_type:body.holiday_type})}

export function dtrTime(value){if(!value)return '';if(value instanceof Date)return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(value);const str=String(value);return str.includes('T')?new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(str)):str.slice(11,16);}
