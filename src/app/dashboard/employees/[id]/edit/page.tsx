import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmployeeForm } from "@/components/employees/employee-form";
import { updateEmployee } from "../../actions";
import Link from "next/link";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: employee } = await supabase
    .from("employees")
    .select("*")
    .eq("id", id)
    .single();

  if (!employee) {
    notFound();
  }

  async function handleUpdate(formData: FormData) {
    "use server";
    await updateEmployee(id, formData);
  }

  return (
    <div className="max-w-2xl">
      <Link
        href={`/dashboard/employees/${id}`}
        className="mb-4 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        &rarr; חזרה לפרטי עובד
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        עריכת עובד: {employee.first_name} {employee.last_name}
      </h1>
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <EmployeeForm employee={employee} action={handleUpdate} />
      </div>
    </div>
  );
}
