export default function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">Libmork</h1>
        <p className="mb-8 text-gray-400">Sistema de RPG de Mesa</p>
        <div className="flex gap-4">
          <a
            href="/player"
            className="rounded-lg bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-700"
          >
            Frente do Jogador
          </a>
          <a
            href="/master"
            className="rounded-lg bg-purple-600 px-6 py-3 font-semibold hover:bg-purple-700"
          >
            Escudo do Mestre
          </a>
        </div>
      </div>
    </div>
  );
}
