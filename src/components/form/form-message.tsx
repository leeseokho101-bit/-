export function FormMessage({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
    >
      ⚠ {message}
    </p>
  );
}
