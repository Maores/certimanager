import { EmployeeForm } from "@/components/employees/employee-form";
import { createEmployee } from "../actions";

export default function NewEmployeePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">הוספת עובד חדש</h1>
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <EmployeeForm action={createEmployee} />
      </div>
    </div>
  );
}
