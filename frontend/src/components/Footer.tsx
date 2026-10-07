export default function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-900 bg-zinc-950 py-6 text-center text-xs text-zinc-500">
      <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>
          AquaVision AI &bull; Underwater Image Enhancement System
        </p>
        <p className="text-zinc-600">
          FastAPI &bull; PyTorch &bull; Next.js &bull; Tailwind CSS
        </p>
      </div>
    </footer>
  );
}
