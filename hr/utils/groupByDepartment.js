export function groupByDepartment(records, departments = []) {
  const departmentNames = new Map(
    departments.map(department => [
      String(department.id),
      department.name,
    ]),
  );

  const groups = new Map();

  for (const record of records) {
    const key =
      record.department_id == null
        ? "unassigned"
        : String(record.department_id);

    if (!groups.has(key)) {
      groups.set(key, {
        department_id: record.department_id,
        department_name:
          departmentNames.get(key) ||
          record.department ||
          "Unassigned",
        employees: [],
      });
    }

    groups.get(key).employees.push(record);
  }

  const compare = (a, b) =>
    String(a || "").localeCompare(String(b || ""), "en", {
      sensitivity: "base",
    });

  const result = Array.from(groups.values());

  for (const group of result) {
    group.employees.sort(
      (a, b) =>
        compare(
          a.last_name || a.employee_name || a.full_name,
          b.last_name || b.employee_name || b.full_name,
        ) ||
        compare(a.first_name, b.first_name) ||
        compare(a.employee_code, b.employee_code),
    );

    group.employee_count = group.employees.length;
  }

  return result.sort(
    (a, b) =>
      compare(a.department_name, b.department_name) ||
      compare(a.department_id, b.department_id),
  );
}