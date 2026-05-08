import VapiButton from "../components/VapiButton";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold mb-4 text-gray-900">Sarjy Assistant</h1>
        <p className="text-gray-600">Click the button below to start talking.</p>
      </div>
      
      <VapiButton />
    </main>
  );
}