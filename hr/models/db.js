import { QueryTypes } from "sequelize";
import { sequelize } from "../config/database.js";
export { sequelize };
export async function rows(sql, replacements = {}, transaction) {
  return sequelize.query(sql, {
    replacements,
    type: QueryTypes.SELECT,
    transaction,
  });
}
export async function execute(sql, replacements = {}, transaction) {
  return sequelize.query(sql, { replacements, transaction });
}
export async function insert(table, values, prefix, codeColumn, transaction) {
  const keys = Object.keys(values);
  const [id] = await execute(
    `INSERT INTO ${table} (${keys.map((k) => "`" + k + "`").join(",")},created_at,updated_at) VALUES (${keys.map((k) => ":" + k).join(",")},NOW(),NOW())`,
    values,
    transaction,
  );
  if (prefix)
    await execute(
      `UPDATE ${table} SET ${codeColumn}=:code WHERE id=:id`,
      { code: prefix + "-" + String(id).padStart(4, "0"), id },
      transaction,
    );
  return id;
}
// All identifiers passed to insert() are fixed by application code, never request data.
// No schema synchronization: import the agreed schema.sql once on the database host.
