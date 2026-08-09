const Block = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded-lg bg-sunken ${className}`} />
);

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Block className="h-4 w-32" />
        <Block className="h-8 w-72" />
      </div>
      <Block className="h-20 w-full" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Block className="h-56" />
        <Block className="h-56" />
      </div>
      <Block className="h-80 w-full" />
    </div>
  );
}
