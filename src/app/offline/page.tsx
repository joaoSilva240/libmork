export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="text-center p-8">
        <h1 className="text-2xl font-bold mb-4">Sem Conexão</h1>
        <p>Você está offline. Reconecte ao servidor para sincronizar.</p>
      </div>
    </div>
  );
}
