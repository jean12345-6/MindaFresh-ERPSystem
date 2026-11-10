export const sampleData = {
  "employees": [
    {
      "id": 1,
      "employee_code": "EMP-0001",
      "first_name": "Liza",
      "last_name": "Santos",
      "department_id": 3,
      "department": "Human Resources",
      "position": "HR Manager",
      "daily_rate": 850,
      "status": "active",
      "employment_type": "regular",
      "hire_date": "2026-01-05",
      "email": "liza@mindafresh.example",
      "vacation_leave_balance": 5,
      "sick_leave_balance": 5
    },
    {
      "id": 2,
      "employee_code": "EMP-0002",
      "first_name": "Marco",
      "last_name": "Reyes",
      "department_id": 1,
      "department": "Sales",
      "position": "Sales Associate",
      "daily_rate": 650,
      "status": "active",
      "employment_type": "regular",
      "hire_date": "2026-01-05",
      "email": "marco@mindafresh.example",
      "vacation_leave_balance": 5,
      "sick_leave_balance": 5
    },
    {
      "id": 3,
      "employee_code": "EMP-0003",
      "first_name": "Ana",
      "last_name": "Dela Cruz",
      "department_id": 4,
      "department": "Finance",
      "position": "Accountant",
      "daily_rate": 800,
      "status": "active",
      "employment_type": "regular",
      "hire_date": "2026-01-05",
      "email": "ana@mindafresh.example",
      "vacation_leave_balance": 5,
      "sick_leave_balance": 5
    },
    {
      "id": 4,
      "employee_code": "EMP-0004",
      "first_name": "Jayson",
      "last_name": "Garcia",
      "department_id": 5,
      "department": "Delivery",
      "position": "Delivery Rider",
      "daily_rate": 600,
      "status": "active",
      "employment_type": "regular",
      "hire_date": "2026-01-05",
      "email": "jayson@mindafresh.example",
      "vacation_leave_balance": 5,
      "sick_leave_balance": 5
    },
    {
      "id": 5,
      "employee_code": "EMP-0005",
      "first_name": "Camille",
      "last_name": "Mendoza",
      "department_id": 2,
      "department": "Inventory",
      "position": "Inventory Clerk",
      "daily_rate": 650,
      "status": "active",
      "employment_type": "probationary",
      "hire_date": "2026-01-05",
      "email": "camille@mindafresh.example",
      "vacation_leave_balance": 5,
      "sick_leave_balance": 5
    },
    {
      "id": 6,
      "employee_code": "EMP-0006",
      "first_name": "Paolo",
      "last_name": "Ramos",
      "department_id": 1,
      "department": "Sales",
      "position": "Cashier",
      "daily_rate": 650,
      "status": "active",
      "employment_type": "regular",
      "hire_date": "2026-01-05",
      "email": "paolo@mindafresh.example",
      "vacation_leave_balance": 5,
      "sick_leave_balance": 5
    },
    {
      "id": 7,
      "employee_code": "EMP-0007",
      "first_name": "Andrea",
      "last_name": "Flores",
      "department_id": 5,
      "department": "Delivery",
      "position": "Delivery Coordinator",
      "daily_rate": 700,
      "status": "active",
      "employment_type": "regular",
      "hire_date": "2026-01-05",
      "email": "andrea@mindafresh.example",
      "vacation_leave_balance": 5,
      "sick_leave_balance": 5
    }
  ],
  "departments": [
    {
      "id": 1,
      "name": "Sales"
    },
    {
      "id": 2,
      "name": "Inventory"
    },
    {
      "id": 3,
      "name": "Human Resources"
    },
    {
      "id": 4,
      "name": "Finance"
    },
    {
      "id": 5,
      "name": "Delivery"
    }
  ],
  "leaves": [
    {
      "id": 1,
      "employee_id": 2,
      "leave_type": "vacation",
      "start_date": "2026-11-05",
      "end_date": "2026-11-06",
      "days": 2,
      "reason": "Family commitment",
      "status": "pending"
    },
    {
      "id": 2,
      "employee_id": 5,
      "leave_type": "sick",
      "start_date": "2026-11-03",
      "end_date": "2026-11-03",
      "days": 1,
      "reason": "Medical appointment",
      "status": "pending"
    },
    {
      "id": 3,
      "employee_id": 4,
      "leave_type": "emergency",
      "start_date": "2026-11-04",
      "end_date": "2026-11-04",
      "days": 1,
      "reason": "Family emergency",
      "status": "pending"
    }
  ],
  "runs": [],
  "users": [
    {
      "id": 1,
      "employee_id": 1,
      "username": "liza.hr",
      "role": "hr_staff",
      "status": "active"
    },
    {
      "id": 2,
      "employee_id": 3,
      "username": "ana.finance",
      "role": "accountant",
      "status": "active"
    }
  ],
  "holidays": [
    {
      "holiday_date": "2026-11-02",
      "name": "All Souls’ Day",
      "holiday_type": "special"
    }
  ]
};
