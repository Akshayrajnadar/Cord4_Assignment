export default function RankingTable({ employees }) {
  return (
    <section className="overflow-hidden rounded-lg border border-[#d7d0c4] bg-white shadow-sm">
      <div className="border-b border-[#e5ded4] p-5">
        <h2 className="text-lg font-semibold text-[#1f2933]">Employee Ranking</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="bg-[#f4efe7] text-[#5f5b53]">
            <tr>
              <th className="px-5 py-3">Employee</th>
              <th className="px-5 py-3">Department</th>
              <th className="px-5 py-3">Minutes</th>
              <th className="px-5 py-3">Productive</th>
              <th className="px-5 py-3">Sessions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.employeeId} className="border-t border-[#eee8df]">
                <td className="px-5 py-3 font-medium">{employee.employeeName}</td>
                <td className="px-5 py-3 text-[#6b655c]">{employee.department}</td>
                <td className="px-5 py-3">{employee.totalMinutes}</td>
                <td className="px-5 py-3">{employee.productiveShare}%</td>
                <td className="px-5 py-3">{employee.sessions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
