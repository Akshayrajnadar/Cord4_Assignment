export default function Breakdown({ categories }) {
  return (
    <section className="rounded-lg border border-[#d7d0c4] bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-[#1f2933]">Category Breakdown</h2>
      <div className="mt-5 space-y-4">
        {categories.map((category) => (
          <div key={category.category}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{category.category}</span>
              <span className="text-[#6b655c]">{category.share}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-[#ece5da]">
              <div
                className="h-2 rounded-full bg-[#2f7d6d]"
                style={{ width: `${category.share}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
