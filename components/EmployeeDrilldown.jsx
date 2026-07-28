export default function EmployeeDrilldown({ employees }) {
  return (
    <section className="rounded-lg border border-[#d7d0c4] bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-[#1f2933]">Employee Drilldown</h2>
      <div className="mt-4 space-y-4">
        {employees.map((employee) => (
          <article key={employee.employeeId} className="border-t border-[#eee8df] pt-4 first:border-t-0 first:pt-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">{employee.employeeName}</h3>
                <p className="text-sm text-[#6b655c]">{employee.role}</p>
              </div>
              <span className="text-sm text-[#7b5f32]">{employee.department}</span>
            </div>
            <p className="mt-2 text-sm text-[#6b655c]">
              {employee.logs.length} reconciled sessions reporting to {employee.manager}.
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
